// ============================================================================
// send-push-notification — Supabase Edge Function (FCM HTTP v1)
// ============================================================================
// Fans out an FCM push notification to every active device registered for a
// given `target_user_id`.
//
// Invoked by:
//   - Workflow actions (announcement broadcast, payment receipt issued, etc.)
//   - The notifications table INSERT trigger (via a Supabase webhook)
//   - Manual admin triggers from the desktop app
//
// Request body:
//   {
//     "target_user_id": "uuid",
//     "title": "string",
//     "body": "string",
//     "data": { "url": "/#/finance", "tag": "payment-123", "link_entity_type": "payment" },
//     "priority": "normal" | "high",
//     "category": "payment" | "absence" | "message" | ... (optional)
//   }
//
// Security:
//   - Only callable with the service_role key (server-side).
//   - The anon key is rejected.
//
// FCM HTTP v1 migration:
//   The legacy `fcm.googleapis.com/fcm/send` endpoint was deprecated by
//   Google. This function uses the HTTP v1 API with an OAuth2 access token
//   minted from the Firebase service-account JSON. To deploy:
//     1. Generate a service-account JSON in the Firebase console:
//        Project Settings → Service Accounts → Generate new private key.
//     2. Upload it as a Supabase secret:
//        supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON=@./firebase-sa.json
//     3. Set the project ID (already in the SA JSON, but we set it again for
//        easy access without parsing the JSON at startup):
//        supabase secrets set FIREBASE_PROJECT_ID=your-firebase-project-id
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushPayload {
  target_user_id: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  priority?: "normal" | "high";
  category?: string;
}

/**
 * Mint an OAuth2 access token from the Firebase service-account JSON using
 * the JWT-bearer flow. We sign the JWT with the private key, then exchange
 * it at Google's OAuth2 token endpoint.
 *
 * This avoids needing the official `google-auth-library` Deno package —
 * we hand-roll a minimal JWT signer using WebCrypto.
 */
async function getFcmAccessToken(
  serviceAccountJson: string,
  scope: string
): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
    project_id: string;
    token_uri: string;
  };

  // Build the JWT header + claims.
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope,
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const unsigned = `${enc(header)}.${enc(claims)}`;

  // Import the private key.
  // The PEM key needs to be converted to a PKCS8 format WebCrypto can import.
  const pemContents = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the JWT.
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${signatureB64}`;

  // Exchange the JWT for an access token.
  const tokenResp = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenResp.ok) {
    const txt = await tokenResp.text();
    throw new Error(`OAuth2 token exchange failed: ${tokenResp.status} ${txt}`);
  }
  const tokenJson = (await tokenResp.json()) as { access_token: string };
  return tokenJson.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: require service_role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const expected = `Bearer ${serviceRoleKey}`;
  if (!serviceRoleKey || authHeader !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ?? "";
  const firebaseProjectId =
    Deno.env.get("FIREBASE_PROJECT_ID") ??
    (serviceAccountJson ? (JSON.parse(serviceAccountJson) as { project_id: string }).project_id : "");

  if (!serviceAccountJson || !firebaseProjectId) {
    return new Response(
      JSON.stringify({
        error:
          "FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID secrets are required for FCM HTTP v1.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let payload: PushPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.target_user_id || !payload.title) {
    return new Response(
      JSON.stringify({ error: "target_user_id and title are required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Look up every active device token for the target user.
  const supabase: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  // If the caller specified a `category`, also consult the
  // notification_preferences table — if the user has opted out of push for
  // that category, skip the fan-out entirely.
  if (payload.category) {
    const { data: pref } = await supabase
      .from("notification_preferences")
      .select("push_enabled")
      .eq("user_profile_id", payload.target_user_id)
      .eq("category", payload.category)
      .maybeSingle();
    if (pref && pref.push_enabled === false) {
      return new Response(
        JSON.stringify({ sent: 0, message: "user has opted out of push for this category" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const { data: tokens, error } = await supabase
    .from("device_tokens")
    .select("token, platform")
    .eq("user_profile_id", payload.target_user_id)
    .eq("is_active", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!tokens || tokens.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, message: "no active devices registered" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Mint the OAuth2 access token (cached for ~1h — the function lifetime is
  // short enough that we re-mint on every invocation; for high traffic,
  // consider caching with Deno KV or a global variable).
  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(
      serviceAccountJson,
      "https://www.googleapis.com/auth/firebase.messaging"
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `FCM auth failed: ${String(err)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fan out via FCM HTTP v1 — one request per token (the v1 API only accepts
  // a single `token` per message, not the legacy `registration_ids` array).
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;
  const priority = payload.priority ?? "high";
  const tag = payload.data?.tag ?? `el-imtiyaz-${payload.category ?? "notification"}`;
  const requireInteraction = payload.data?.priority === "urgent";

  const results: { token: string; ok: boolean; error?: string }[] = [];
  await Promise.all(
    tokens.map(async (t) => {
      const message = {
        message: {
          token: t.token,
          notification: {
            title: payload.title,
            body: payload.body ?? "",
          },
          android: {
            priority: priority === "high" ? "high" : "normal",
            notification: {
              icon: "icon-192",
              color: "#349BD4",
              tag,
              priority: priority === "high" ? "high" : "default",
              notification_count: 1,
              click_action: payload.data?.url ?? "/",
            },
          },
          webpush: {
            notification: {
              title: payload.title,
              body: payload.body ?? "",
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              tag,
              requireInteraction,
              actions: requireInteraction
                ? []
                : [{ action: "open", title: "Ouvrir" }, { action: "dismiss", title: "Ignorer" }],
            },
            fcm_options: {
              link: payload.data?.url ?? "/",
            },
          },
          data: payload.data ?? {},
        },
      };

      try {
        const resp = await fetch(fcmEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(message),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          results.push({ token: t.token, ok: false, error: txt });
          // If the token is no longer valid (UNREGISTERED), mark it inactive
          // so we stop trying to send to it.
          if (/UNREGISTERED|invalid-registration-token|registration-token-not-registered/i.test(txt)) {
            await supabase
              .from("device_tokens")
              .update({ is_active: false })
              .eq("token", t.token);
          }
        } else {
          results.push({ token: t.token, ok: true });
        }
      } catch (err) {
        results.push({ token: t.token, ok: false, error: String(err) });
      }
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return new Response(
    JSON.stringify({
      sent,
      failed: failed.length,
      failures: failed.slice(0, 5), // surface a sample of failures for debugging
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// ============================================================================
// send-push-notification — Supabase Edge Function
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
//     "data": { "url": "/finance", "tag": "payment-123" },
//     "priority": "normal" | "high"
//   }
//
// Security:
//   - Only callable with the service_role key (server-side).
//   - The anon key is rejected.
//
// This file is provided as a REFERENCE — deploy it to your Supabase project
// with `supabase functions deploy send-push-notification`.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY");
const FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send";

interface PushPayload {
  target_user_id: string;
  title: string;
  body?: string;
  data?: Record<string, string>;
  priority?: "normal" | "high";
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

  if (!FCM_SERVER_KEY) {
    return new Response(
      JSON.stringify({ error: "FCM_SERVER_KEY secret not set" }),
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
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

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

  // Fan out to FCM (legacy HTTP v1 API — works with the server key).
  // For production, migrate to FCM HTTP v1 with OAuth2 tokens.
  const registrationIds = tokens.map((t) => t.token);
  const fcmBody = {
    registration_ids: registrationIds,
    priority: payload.priority ?? "high",
    notification: {
      title: payload.title,
      body: payload.body ?? "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: payload.data?.tag ?? "el-imtiyaz-notification",
    },
    data: payload.data ?? {},
  };

  try {
    const resp = await fetch(FCM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${FCM_SERVER_KEY}`,
      },
      body: JSON.stringify(fcmBody),
    });
    const result = await resp.json();
    return new Response(
      JSON.stringify({ sent: registrationIds.length, fcm: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `FCM request failed: ${String(err)}` }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

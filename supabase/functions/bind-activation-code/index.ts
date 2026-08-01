// ============================================================================
// bind-activation-code — Supabase Edge Function
// ============================================================================
// Implements the Path-A self-service activation flow described in
// Entire_Project_Plan.txt §02.08.
//
// A parent who has signed in via Google OAuth but whose account is still in
// the `pending` state can submit a 6–7 digit numeric activation code that
// the school issued via the desktop app. This function:
//
//   1. Verifies the caller's JWT (must be authenticated).
//   2. Resolves the caller's user_profiles row + tenant_id.
//   3. Calls the existing `public.bind_activation_code()` SQL function
//      (defined in desktop migration 0005_crm.sql) which atomically:
//        - locks the activation_codes row by code,
//        - verifies it is not yet bound and not expired,
//        - binds bound_to_auth_user_id = caller.auth_user_id,
//        - updates parents.auth_user_id = caller.auth_user_id for the
//          parent_id stored on the code,
//        - returns (parent_id, parent_full_name, student_count).
//   4. On success, sets user_profiles.status = 'active' and inserts a
//      role_assignments row so the user can immediately access the portal
//      (the desktop admin can still flip status back to 'suspended' if the
//      binding was incorrect).
//
// Security:
//   - Callable only with a valid user JWT (anonymous requests are rejected).
//   - The service_role key is used internally to update user_profiles.status
//     and insert role_assignments — these are admin-only operations.
//   - The bind_activation_code() SQL function uses SELECT ... FOR UPDATE so
//     concurrent submissions of the same code are correctly serialized.
// ============================================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing Supabase env vars." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // The caller must include their JWT bearer token.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing auth token." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const callerJwt = authHeader.slice("Bearer ".length);

  // Build a user-scoped client (respects RLS) to resolve the caller's profile.
  const userClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authUserId = userData.user.id;

  // Fetch the caller's user_profiles row to resolve tenant_id and current status.
  const { data: profile, error: profileErr } = await userClient
    .from("user_profiles")
    .select("id, tenant_id, status, email, display_name")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileErr || !profile) {
    return new Response(
      JSON.stringify({ error: "Profile not found. Please sign in again." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (profile.status === "active") {
    return new Response(
      JSON.stringify({ error: "Account is already active.", already_active: true }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse the request body.
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const code = (body.code ?? "").trim();
  // 6–7 digit numeric code per the plan §02.08.
  if (!/^\d{6,7}$/.test(code)) {
    return new Response(
      JSON.stringify({ error: "Activation code must be 6 or 7 digits." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Call bind_activation_code() using the service-role client (it needs
  // elevated privileges to UPDATE parents.auth_user_id and activation_codes).
  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: bindResult, error: bindErr } = await adminClient.rpc(
    "bind_activation_code",
    {
      p_tenant_id: profile.tenant_id,
      p_code: code,
      p_auth_user_id: authUserId,
    }
  );

  if (bindErr) {
    const msg = bindErr.message ?? "";
    if (/already.*used|invalid|not found/i.test(msg)) {
      return new Response(
        JSON.stringify({ error: "Invalid or already-used activation code." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (/expired/i.test(msg)) {
      return new Response(
        JSON.stringify({ error: "This activation code has expired. Please request a new one from the administration." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: `Activation failed: ${msg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // bind_activation_code returns (parent_id, parent_full_name, student_count).
  // The exact shape depends on the SQL function — handle both forms.
  const result = (Array.isArray(bindResult) ? bindResult[0] : bindResult) as {
    parent_id?: string;
    parent_full_name?: string;
    student_count?: number;
  } | null;

  if (!result?.parent_id) {
    return new Response(
      JSON.stringify({ error: "Activation returned no parent binding." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Activate the user_profiles row + grant the 'parent' role.
  // The role_assignments row needs role_id — look it up by code='parent'.
  const { data: parentRole } = await adminClient
    .from("roles")
    .select("id")
    .eq("code", "parent")
    .maybeSingle();

  if (parentRole?.id) {
    await adminClient
      .from("role_assignments")
      .upsert(
        {
          user_profile_id: profile.id,
          tenant_id: profile.tenant_id,
          role_id: parentRole.id,
          assigned_by: profile.id, // self-service — record that the user self-activated
          assigned_at: new Date().toISOString(),
        },
        { onConflict: "user_profile_id,tenant_id,role_id" }
      );
  }

  // Flip user_profiles.status to 'active' so the portal lets the user in.
  // Use a non-revocable status — the desktop admin can still suspend later.
  await adminClient
    .from("user_profiles")
    .update({
      status: "active",
      approval_request_id: null,
    })
    .eq("id", profile.id);

  return new Response(
    JSON.stringify({
      success: true,
      parent_id: result.parent_id,
      parent_full_name: result.parent_full_name,
      student_count: result.student_count ?? 0,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

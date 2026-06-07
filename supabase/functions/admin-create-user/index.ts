import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const allowedModules = new Set([
  "dashboard",
  "students",
  "parents",
  "classes",
  "finance",
  "cash",
  "accounting",
  "teachers",
  "hr",
  "grades",
  "attendance",
  "schedule",
  "messages",
  "documents",
  "users",
  "settings",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeModules(value: unknown) {
  if (!Array.isArray(value)) return ["dashboard"];

  const modules = value.filter(item => typeof item === "string" && allowedModules.has(item));
  return Array.from(new Set(["dashboard", ...modules]));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration" }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace("Bearer ", "").trim();

    if (!token) {
      return jsonResponse({ error: "Missing authorization token" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid authorization token" }, 401);
    }

    const { data: requesterProfile, error: requesterError } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, role:roles(name)")
      .eq("id", authData.user.id)
      .maybeSingle();

    const requesterRole = Array.isArray(requesterProfile?.role)
      ? requesterProfile?.role[0]?.name
      : requesterProfile?.role?.name;

    if (requesterError || !requesterProfile || !["super_admin", "admin"].includes(requesterRole)) {
      return jsonResponse({ error: "Only admins can create users" }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const phone = String(body.phone || "").trim();
    const roleName = String(body.role_name || "teacher");
    const accountType = String(body.account_type || "staff");
    const active = body.active !== false;
    const moduleAccess = normalizeModules(body.module_access);
    const schoolId = String(body.school_id || requesterProfile.school_id);

    if (!email || !password || !firstName || !lastName) {
      return jsonResponse({ error: "Email, password, first_name and last_name are required" }, 400);
    }

    if (requesterRole !== "super_admin" && schoolId !== requesterProfile.school_id) {
      return jsonResponse({ error: "Admins can only create users in their own school" }, 403);
    }

    if (requesterRole !== "super_admin" && roleName === "super_admin") {
      return jsonResponse({ error: "Only a super admin can create another super admin" }, 403);
    }

    const { data: role, error: roleError } = await supabaseAdmin
      .from("roles")
      .select("id, name")
      .eq("name", roleName)
      .maybeSingle();

    if (roleError || !role) {
      return jsonResponse({ error: "Unknown role" }, 400);
    }

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone,
      },
      app_metadata: {
        role: roleName,
        school_id: schoolId,
      },
    });

    if (createError || !createdUser.user) {
      return jsonResponse({ error: createError?.message || "Unable to create user" }, 400);
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: createdUser.user.id,
      school_id: schoolId,
      role_id: role.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      account_type: accountType,
      module_access: moduleAccess,
      active,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 400);
    }

    return jsonResponse({
      message: "User created",
      user_id: createdUser.user.id,
      email,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

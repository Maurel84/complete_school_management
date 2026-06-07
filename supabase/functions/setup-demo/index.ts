import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const allModules = [
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
];

const accounts = [
  {
    email: "admin@schoolmanager.pro",
    password: "Admin123!",
    first_name: "Admin",
    last_name: "General",
    phone: "+225 07 00 00 01",
    role_name: "super_admin",
    school_id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    account_type: "admin",
  },
  {
    email: "demo@schoolmanager.pro",
    password: "Demo123!",
    first_name: "Demo",
    last_name: "Primaire",
    phone: "+225 07 00 00 02",
    role_name: "admin",
    school_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    account_type: "demo",
  },
];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: usersPage, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      return jsonResponse({ error: usersError.message }, 400);
    }

    const results = [];

    for (const account of accounts) {
      const { data: role, error: roleError } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", account.role_name)
        .maybeSingle();

      if (roleError || !role) {
        results.push({ email: account.email, error: "Role not found" });
        continue;
      }

      const existingUser = usersPage.users.find(user => user.email?.toLowerCase() === account.email);
      const authPayload = {
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: {
          first_name: account.first_name,
          last_name: account.last_name,
          phone: account.phone,
        },
        app_metadata: {
          role: account.role_name,
          school_id: account.school_id,
        },
      };

      const { data: authResult, error: authError } = existingUser
        ? await supabaseAdmin.auth.admin.updateUserById(existingUser.id, authPayload)
        : await supabaseAdmin.auth.admin.createUser(authPayload);

      if (authError || !authResult.user) {
        results.push({ email: account.email, error: authError?.message || "Unable to create user" });
        continue;
      }

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: authResult.user.id,
        school_id: account.school_id,
        role_id: role.id,
        email: account.email,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
        account_type: account.account_type,
        module_access: allModules,
        active: true,
        updated_at: new Date().toISOString(),
      });

      results.push({
        email: account.email,
        password: account.password,
        user_id: authResult.user.id,
        status: profileError ? "profile_error" : existingUser ? "updated" : "created",
        error: profileError?.message,
      });
    }

    return jsonResponse({
      message: "Demo and admin accounts are ready",
      accounts: results,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

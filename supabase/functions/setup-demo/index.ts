import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Check if demo user already exists
    const checkRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
       apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    const usersData = await checkRes.json();
    const existing = usersData.users?.find(
      (u: any) => u.email === "admin@schoolmanager.pro"
    );

    if (existing) {
      return new Response(
        JSON.stringify({
          message: "Demo user already exists",
          email: "admin@schoolmanager.pro",
          password: "Admin123!",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create the demo admin user via admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "admin@schoolmanager.pro",
        password: "Admin123!",
        email_confirm: true,
        app_metadata: {
          role: "admin",
          school_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
          provider: "email",
          providers: ["email"],
        },
        user_metadata: {
          first_name: "Admin",
          last_name: "Demo",
          phone: "+225 07 00 00 00",
        },
      }),
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      return new Response(
        JSON.stringify({ error: createData }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Demo user created successfully",
        email: "admin@schoolmanager.pro",
        password: "Admin123!",
        user_id: createData.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

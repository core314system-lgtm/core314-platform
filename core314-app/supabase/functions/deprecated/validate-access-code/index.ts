import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { withSentry, breadcrumb, handleSentryTest, jsonError } from "../_shared/sentry.ts";

serve(withSentry(async (req) => {
  const testResponse = await handleSentryTest(req);
  if (testResponse) return testResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { code } = await req.json();
    if (!code) return new Response(JSON.stringify({ error: "Missing code" }), { status: 400 });

    const { data } = await supabase
      .from("beta_access_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (!data) return new Response(JSON.stringify({ valid: false }), { status: 200 });

    if (data.expires_at && new Date(data.expires_at) < new Date())
      return new Response(JSON.stringify({ valid: false, reason: "expired" }), { status: 200 });

    if (data.uses >= data.max_uses)
      return new Response(JSON.stringify({ valid: false, reason: "maxed_out" }), { status: 200 });

    return new Response(JSON.stringify({ valid: true, code_id: data.id }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
}, { name: "validate-access-code" }));
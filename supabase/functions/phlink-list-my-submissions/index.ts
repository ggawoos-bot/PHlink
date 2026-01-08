import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getEnvOrThrow = (key: string) => {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
};

type Body = {
  surveyId: string;
  agencyId: string;
  systemUserId: string;
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
    const serviceRoleKey = getEnvOrThrow("SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as Partial<Body>;
    const surveyId = body.surveyId;
    const agencyId = body.agencyId;
    const systemUserId = (body.systemUserId ?? "").trim();

    if (!surveyId || !agencyId || !systemUserId) {
      return json(400, { error: "Missing required fields: surveyId, agencyId, systemUserId" });
    }

    const rawAgencyId = String(agencyId);
    const agencyCode = rawAgencyId.includes(":") ? rawAgencyId.split(":").pop() ?? rawAgencyId : rawAgencyId;
    const agencyOr = rawAgencyId === agencyCode
      ? `agency_id.eq.${rawAgencyId},agency_id.like.%:${agencyCode}`
      : `agency_id.eq.${rawAgencyId},agency_id.eq.${agencyCode}`;

    console.log("[phlink-list-my-submissions] request", {
      surveyId,
      agencyId: rawAgencyId,
      agencyCode,
      systemUserId,
      agencyOr,
    });

    // Only return rows that match the lookup key
    const { data, error } = await supabase
      .schema("phlink")
      .from("survey_submissions")
      .select("id,survey_id,agency_id,agency_name,data,submitted_at")
      .eq("survey_id", surveyId)
      .or(agencyOr)
      .filter("data->>__system_user_id", "eq", systemUserId)
      .order("submitted_at", { ascending: false });

    console.log("[phlink-list-my-submissions] result", {
      error: error?.message ?? null,
      rows: (data ?? []).length,
    });

    if (!error && (data ?? []).length === 0) {
      const { error: diagErr, count: diagCount } = await supabase
        .schema("phlink")
        .from("survey_submissions")
        .select("id", { count: "exact", head: true })
        .eq("survey_id", surveyId)
        .or(agencyOr);

      console.log("[phlink-list-my-submissions] diag", {
        error: diagErr?.message ?? null,
        matchSurveyAgencyCount: diagCount ?? null,
      });
    }

    if (error) return json(500, { error: error.message });

    return json(200, { rows: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});

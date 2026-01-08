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
  id: string;
  surveyId: string;
  agencyId: string;
  systemUserId: string;
  data: Record<string, unknown>;
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const supabaseUrl = getEnvOrThrow("SUPABASE_URL");
    const serviceRoleKey = getEnvOrThrow("SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = (await req.json()) as Partial<Body>;
    const id = body.id;
    const surveyId = body.surveyId;
    const agencyId = body.agencyId;
    const systemUserId = (body.systemUserId ?? "").trim();
    const data = body.data;

    if (!id || !surveyId || !agencyId || !systemUserId || !data) {
      return json(400, {
        error: "Missing required fields: id, surveyId, agencyId, systemUserId, data",
      });
    }

    const rawAgencyId = String(agencyId);
    const agencyCode = rawAgencyId.includes(":") ? rawAgencyId.split(":").pop() ?? rawAgencyId : rawAgencyId;
    const agencyOr = rawAgencyId === agencyCode
      ? `agency_id.eq.${rawAgencyId},agency_id.like.%:${agencyCode}`
      : `agency_id.eq.${rawAgencyId},agency_id.eq.${agencyCode}`;

    console.log("[phlink-update-my-submission] request", {
      id,
      surveyId,
      agencyId: rawAgencyId,
      agencyCode,
      systemUserId,
      agencyOr,
    });

    // Verify ownership key matches the existing row.
    const { data: existing, error: findErr } = await supabase
      .schema("phlink")
      .from("survey_submissions")
      .select("id,survey_id,agency_id,data")
      .eq("id", id)
      .eq("survey_id", surveyId)
      .or(agencyOr)
      .maybeSingle();

    if (findErr) return json(500, { error: findErr.message });
    if (!existing) return json(404, { error: "Submission not found" });

    const existingKey = (existing as any)?.data?.__system_user_id;
    console.log("[phlink-update-my-submission] found", {
      existingKey: String(existingKey ?? ""),
    });
    if (String(existingKey ?? "") !== systemUserId) {
      return json(403, { error: "Invalid systemUserId" });
    }

    // Ensure key is preserved
    const nextData = { ...(data as any), __system_user_id: systemUserId };

    const { data: updated, error: updErr } = await supabase
      .schema("phlink")
      .from("survey_submissions")
      .update({ data: nextData })
      .eq("id", id)
      .select("id,survey_id,agency_id,agency_name,data,submitted_at")
      .single();

    if (updErr) return json(500, { error: updErr.message });

    return json(200, { submission: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});

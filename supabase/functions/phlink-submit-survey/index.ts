// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const getEnvOrThrow = (key: string) => {
  const v = Deno.env.get(key)
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

type SubmitSurveyBody = {
  surveyId: string
  agencyId: string
  agencyName?: string
  answers: Record<string, unknown>
}

const parseMs = (iso: unknown) => {
  if (typeof iso !== "string") return NaN
  const ms = new Date(iso).getTime()
  return ms
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return json(405, { error: "Method not allowed" })

    const supabaseUrl = getEnvOrThrow("SUPABASE_URL")
    const serviceRoleKey = getEnvOrThrow("SERVICE_ROLE_KEY")
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json()) as Partial<SubmitSurveyBody>
    const surveyId = body.surveyId
    const agencyId = body.agencyId
    const agencyName = body.agencyName
    const answers = body.answers

    if (!surveyId || !agencyId || !answers) {
      return json(400, { error: "Missing required fields: surveyId, agencyId, answers" })
    }

    // Enforce submission window
    const { data: survey, error: surveyErr } = await supabase
      .schema("phlink")
      .from("surveys")
      .select("id,status,start_at,end_at")
      .eq("id", surveyId)
      .maybeSingle()

    if (surveyErr) return json(500, { error: surveyErr.message })
    const now = Date.now()
    if (survey) {
      if (survey.status === "CLOSED") return json(409, { error: "Survey is closed" })

      const startMs = parseMs(survey.start_at)
      const endMs = parseMs(survey.end_at)
      if (!Number.isNaN(startMs) && now < startMs) {
        return json(409, { error: "Submission period has not started" })
      }
      if (!Number.isNaN(endMs) && now > endMs) {
        return json(409, { error: "Submission period has ended" })
      }
    }

    const submissionId = crypto.randomUUID()
    const submittedAt = new Date(now).toISOString()

    // Requires unique constraint on (survey_id, agency_id)
    const { data: upserted, error: upsertErr } = await supabase
      .schema("phlink")
      .from("survey_submissions")
      .upsert(
        {
          id: submissionId,
          survey_id: surveyId,
          agency_id: agencyId,
          agency_name: agencyName ?? null,
          data: answers,
          submitted_at: submittedAt,
        },
        { onConflict: "survey_id,agency_id" },
      )
      .select("id,survey_id,agency_id,agency_name,data,submitted_at")
      .single()

    if (upsertErr) return json(500, { error: upsertErr.message })

    return json(200, { submission: upserted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/phlink-submit-survey' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

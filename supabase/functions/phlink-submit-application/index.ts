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

const toHex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")

const sha256Hex = async (text: string) => {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return toHex(digest)
}

type SubmitApplicationBody = {
  eventId: string
  sessionId: string
  agencyId: string
  agencyName?: string
  paxCount: number
  lodgingCount?: number
  mealData?: Record<string, number>
  password: string
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return json(405, { error: "Method not allowed" })

    const supabaseUrl = getEnvOrThrow("SUPABASE_URL")
    const serviceRoleKey = getEnvOrThrow("SERVICE_ROLE_KEY")
    const passwordSalt = Deno.env.get("PHLINK_PASSWORD_SALT") ?? ""

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const body = (await req.json()) as Partial<SubmitApplicationBody>
    const {
      eventId,
      sessionId,
      agencyId,
      agencyName,
      paxCount,
      lodgingCount,
      mealData,
      password,
    } = body

    if (!eventId || !sessionId || !agencyId) {
      return json(400, { error: "Missing required fields: eventId, sessionId, agencyId" })
    }
    if (!password || String(password).length < 4) {
      return json(400, { error: "Password must be at least 4 characters" })
    }
    if (!Number.isFinite(paxCount) || (paxCount as number) <= 0) {
      return json(400, { error: "paxCount must be >= 1" })
    }
    if (lodgingCount != null && (!Number.isFinite(lodgingCount) || lodgingCount < 0)) {
      return json(400, { error: "lodgingCount must be >= 0" })
    }
    if (lodgingCount != null && lodgingCount > (paxCount as number)) {
      return json(400, { error: "lodgingCount cannot exceed paxCount" })
    }

    // Validate event/session exist & capacity (skip if sessions are not yet migrated)
    const { data: session, error: sessionErr } = await supabase
      .schema("phlink")
      .from("event_sessions")
      .select("id,event_id,max_capacity,current_capacity")
      .eq("id", sessionId)
      .maybeSingle()

    if (sessionErr) return json(500, { error: sessionErr.message })

    if (session) {
      if (session.event_id !== eventId) return json(400, { error: "Session does not belong to event" })

      const current = Number(session.current_capacity ?? 0)
      const max = Number(session.max_capacity ?? 0)
      if (current + (paxCount as number) > max) {
        return json(409, { error: "Session capacity exceeded" })
      }
    }

    const passwordHash = await sha256Hex(`${passwordSalt}:${agencyId}:${password}`)

    const now = new Date()
    const appId = crypto.randomUUID()

    const { data: inserted, error: insErr } = await supabase
      .schema("phlink")
      .from("applications")
      .insert({
        id: appId,
        event_id: eventId,
        session_id: sessionId,
        agency_id: agencyId,
        agency_name: agencyName ?? null,
        pax_count: paxCount,
        lodging_count: lodgingCount ?? 0,
        meal_data: mealData ?? {},
        password_hash: passwordHash,
        created_at: now.toISOString(),
      })
      .select("id,event_id,session_id,agency_id,agency_name,pax_count,lodging_count,meal_data,created_at")
      .single()

    if (insErr) {
      // Unique violation (agency_id,event_id) etc.
      return json(409, { error: insErr.message })
    }

    return json(200, { application: inserted })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/phlink-submit-application' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

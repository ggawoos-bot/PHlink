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

type GetApplicationBody = {
  agencyId: string
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

    const body = (await req.json()) as Partial<GetApplicationBody>
    const agencyId = body.agencyId
    const password = body.password

    if (!agencyId || !password) {
      return json(400, { error: "Missing required fields: agencyId, password" })
    }
    if (String(password).length < 4) {
      return json(400, { error: "Password must be at least 4 characters" })
    }

    const passwordHash = await sha256Hex(`${passwordSalt}:${agencyId}:${password}`)

    const { data, error } = await supabase
      .schema("phlink")
      .from("applications")
      .select(
        "id,event_id,session_id,agency_id,agency_name,pax_count,lodging_count,meal_data,created_at",
      )
      .eq("agency_id", agencyId)
      .eq("password_hash", passwordHash)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) return json(500, { error: error.message })

    const application = (data ?? [])[0] ?? null
    if (!application) return json(404, { error: "No matching application" })

    return json(200, { application })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json(500, { error: msg })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/phlink-get-application' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/

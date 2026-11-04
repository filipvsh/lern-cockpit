// Einstiegspunkt der Edge Function „ai-tutor“.
// Secrets: ANTHROPIC_API_KEY (Pflicht), ALLOWED_ORIGIN (optional, kommagetrennt; https://filipvsh.github.io ist immer erlaubt, sobald etwas gesetzt ist)
// SUPABASE_URL und SUPABASE_ANON_KEY stellt Supabase automatisch bereit.
import Anthropic from "npm:@anthropic-ai/sdk@^0.131.0";
import { createHandler } from "./handler.ts";

let client: Anthropic | null = null;
Deno.serve(createHandler({
  env: k => Deno.env.get(k),
  fetch,
  anthropic: () => (client ??= new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") })),
}));

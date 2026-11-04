// Baut aus handler.ts + index.ts eine einzige Datei zum Hineinkopieren in den
// Supabase-Editor (Edge Functions → ai-tutor → Code → ersetzen → Deploy).
// Ausführen: node scripts/build-ai.mjs   ·   Ergebnis: docs/ai-tutor-einzeldatei.ts
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("../supabase/functions/ai-tutor/", import.meta.url);
const strip = s => s.replace(/^import .*$/gm, "").replace(/^export /gm, "");
export function bundle() {
  return "// AUTOMATISCH ERZEUGT aus supabase/functions/ai-tutor/* – nicht von Hand ändern (node scripts/build-ai.mjs)\n" +
    "// Lern-Cockpit · Edge Function „ai-tutor“ als eine Datei.\n// @ts-nocheck\nimport Anthropic from \"npm:@anthropic-ai/sdk@^0.131.0\";\n" +
    ["handler.ts", "index.ts"].map(f => "\n// ===== " + f + " =====\n" + strip(readFileSync(new URL(f, dir), "utf8"))).join("");
}
if (import.meta.url === "file://" + process.argv[1]) { writeFileSync(new URL("../docs/ai-tutor-einzeldatei.ts", import.meta.url), bundle()); console.log("docs/ai-tutor-einzeldatei.ts geschrieben"); }

// Baut aus webpush.mjs + plan.mjs + index.ts eine einzige Datei zum Hineinkopieren in den
// Supabase-Editor (Edge Functions → Deploy a new function → Via Editor).
// Ausführen: node scripts/build-push.mjs   ·   Ergebnis: docs/push-reminder-einzeldatei.ts
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL("../supabase/functions/push-reminder/", import.meta.url);
const strip = s => s.replace(/^import .*$/gm, "").replace(/^export /gm, "");
export function bundle() {
  return "// AUTOMATISCH ERZEUGT aus supabase/functions/push-reminder/* – nicht von Hand ändern (node scripts/build-push.mjs)\n" +
    "// Lern-Cockpit · Edge Function „push-reminder“ als eine Datei.\n// @ts-nocheck\n" +
    ["webpush.mjs", "plan.mjs", "index.ts"].map(f => "\n// ===== " + f + " =====\n" + strip(readFileSync(new URL(f, dir), "utf8"))).join("");
}
if (import.meta.url === "file://" + process.argv[1]) { writeFileSync(new URL("../docs/push-reminder-einzeldatei.ts", import.meta.url), bundle()); console.log("docs/push-reminder-einzeldatei.ts geschrieben"); }

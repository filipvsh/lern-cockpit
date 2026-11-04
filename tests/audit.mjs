// Screenshot-Rundgang fürs Handy (390 px): node tests/audit.mjs <Ordner>
import { MockBackend } from "./mock-backend.mjs";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
let pw; try { pw = await import("playwright"); } catch (e) { pw = await import("/opt/node-tools/node_modules/playwright/index.mjs"); }
const { chromium } = pw.default || pw;
const APP = "file://" + fileURLToPath(new URL("../index.html", import.meta.url));
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const b = new MockBackend({ packs: true });
const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
b.db.klausuren.push({ id: "11111111-aaaa-4aaa-8aaa-0000000000f1", fach: "Französisch", thema: "Klausur Nr. 1", datum: day(9), themen: [], material: [], mitnehmen: [], punkte: null, vokabel_lektionen: [], topics_migrated: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", e => errs.push(e.message)); page.on("dialog", d => d.accept());
await page.route("**/*", r => b.handle(r));
await page.goto(APP + "#/dashboard");
await page.waitForSelector("#auth_form"); await page.fill("#a_mail", "filip@example.org"); await page.fill("#a_pw", "geheim123"); await page.click("#a_go");
await page.waitForSelector(".dsh", { timeout: 20000 }); await page.waitForTimeout(2500);
const pages = (process.argv[3] || "dashboard,lernplan,vokabeln,noten,aufgaben,stundenplan,spiele,trainer,drill,mathe,fortschritt,einstellungen,ki,material,info").split(",");
for (const p of pages) {
  await page.evaluate(h => { location.hash = h; }, "#/" + p); await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, small: [...document.querySelectorAll("button, a, input, select")].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 32 || r.width < 32) && getComputedStyle(e).visibility !== "hidden"; }).length }));
  console.log(p.padEnd(14), "breite", m.w, "höhe", m.h, "kleine Ziele", m.small);
  await page.screenshot({ path: OUT + "/" + p.replace(/\W/g, "_") + ".png", fullPage: true });
}
// Mehr-Menü
await page.evaluate(() => { location.hash = "#/dashboard"; }); await page.waitForTimeout(700);
const more = await page.$(".mnav [data-more], .mnav button:last-child, #mnav_more"); if (more) { await more.click(); await page.waitForTimeout(500); await page.screenshot({ path: OUT + "/mehr.png" }); }
console.log("Fehler:", errs.length ? errs : "keine");
await browser.close();

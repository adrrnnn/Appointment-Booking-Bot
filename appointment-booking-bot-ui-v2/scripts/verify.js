/**
 * Post-build sanity checks: artifacts exist and packaging config matches expectations.
 * Run from package root after: npm run build && (cd bot && npm run build)
 * Usage: node scripts/verify.js [--checklist]
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const args = process.argv.slice(2);
const printChecklist = args.includes("--checklist");

function mustExist(rel, label) {
  const abs = path.join(root, ...rel.split("/"));
  if (!fs.existsSync(abs)) {
    console.error(`[verify] FAIL: missing ${label}: ${rel}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`[verify] OK: ${rel}`);
  return true;
}

function mustContain(fileRel, needles, label) {
  const abs = path.join(root, ...fileRel.split("/"));
  if (!fs.existsSync(abs)) {
    console.error(`[verify] FAIL: ${label}: file missing ${fileRel}`);
    process.exitCode = 1;
    return false;
  }
  const text = fs.readFileSync(abs, "utf8");
  for (const n of needles) {
    if (!text.includes(n)) {
      console.error(`[verify] FAIL: ${label}: expected substring not found in ${fileRel}: ${JSON.stringify(n)}`);
      process.exitCode = 1;
      return false;
    }
  }
  console.log(`[verify] OK: ${label} (${fileRel})`);
  return true;
}

console.log("[verify] Root:", root);

const required = [
  ["out/main/index.js", "Main bundle"],
  ["out/preload/index.js", "Preload bundle"],
  ["out/renderer/index.html", "Renderer HTML"],
  ["bot/dist/index.js", "Bot entry (build bot before verify)"],
];

let ok = true;
for (const [rel, label] of required) {
  ok = mustExist(rel, label) && ok;
}

// Packaged app resolves bot under process.resourcesPath (see electron/engine-bridge.ts)
ok =
  mustContain(
    "out/main/index.js",
    ["resourcesPath", "bot", "dist", "index.js"],
    "Main references packaged bot path",
  ) && ok;

// electron-builder ships bot as extraResources
let eb;
try {
  eb = require(path.join(root, "electron-builder.config.js"));
} catch (e) {
  console.error("[verify] FAIL: could not load electron-builder.config.js", e.message);
  process.exitCode = 1;
  ok = false;
}

if (eb) {
  const extra = eb.extraResources || [];
  const hasBotDist = extra.some(
    (e) => e && e.from === "bot/dist" && (e.to === "bot/dist" || e.to === "bot\\dist"),
  );
  const hasBotNm = extra.some((e) => e && String(e.from).replace(/\\/g, "/") === "bot/node_modules");
  if (!hasBotDist) {
    console.error("[verify] FAIL: electron-builder extraResources must include bot/dist -> bot/dist");
    process.exitCode = 1;
    ok = false;
  } else {
    console.log("[verify] OK: extraResources includes bot/dist");
  }
  if (!hasBotNm) {
    console.error("[verify] FAIL: electron-builder extraResources must include bot/node_modules");
    process.exitCode = 1;
    ok = false;
  } else {
    console.log("[verify] OK: extraResources includes bot/node_modules");
  }

  const winTargets = (eb.win && eb.win.target) || [];
  const types = winTargets.map((t) => (typeof t === "string" ? t : t && t.target)).filter(Boolean);
  const hasNsis = types.includes("nsis");
  const hasPortable = types.includes("portable");
  if (!hasNsis || !hasPortable) {
    console.error(
      "[verify] FAIL: win.target must include nsis and portable, got:",
      JSON.stringify(types),
    );
    process.exitCode = 1;
    ok = false;
  } else {
    console.log("[verify] OK: win targets include nsis and portable");
  }
}

// Dev bot path in source (sanity)
ok =
  mustContain("electron/engine-bridge.ts", ['join(__dirname, "../../bot")', "process.resourcesPath"], "engine-bridge dev/prod paths") &&
  ok;

if (ok) {
  console.log("[verify] All checks passed.");
} else {
  console.error("[verify] One or more checks failed.");
}

if (printChecklist) {
  console.log(`
--- VM / release checklist (human) ---
1. Copy release/Setup*.exe (and portable exe if needed) to a clean Windows VM or machine.
2. Install from Setup; launch app. SmartScreen warning is expected if unsigned.
3. Create session, open Console, add driver row; start bot — logs should stream; stop bot.
4. With bot running, try closing app — native confirm should appear.
5. Multi-session: add second session; close tab (x) only when bot not running.
6. Portable: run from path without spaces, then from path with spaces if you rely on that.
7. Live Fasah: use valid tokens. HTTP 401/403/timeouts are often credential/API, not UI bugs.
---`);
}

process.exit(process.exitCode || 0);

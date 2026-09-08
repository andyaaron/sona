// Stop — AGENTS.md §4 Definition of Done. Runs the verification gates that
// apply to what changed on this branch; blocks the stop while any fail.
// Results are cached per tree state so an unchanged tree never re-runs.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { readInput, block, changedFiles, git, run, tail, ROOT } from "./lib.mjs";

const input = readInput();
if (input.stop_hook_active) process.exit(0); // already inside a gate-triggered continuation

const { ref, files } = changedFiles();
if (!files.length) process.exit(0);

const has = (re) => files.some((f) => re.test(f));
const gates = [];
if (has(/\.(ts|tsx|mts|cts)$/) || has(/(^|\/)tsconfig[^/]*\.json$/)) gates.push({ label: "pnpm typecheck", cmd: "pnpm", args: ["typecheck"] });
if (has(/^apps\/sona\.client\//) || has(/^packages\//)) {
  gates.push({ label: "pnpm build", cmd: "pnpm", args: ["build"] });
  gates.push({ label: "pnpm test", cmd: "pnpm", args: ["test"] });
}
if (has(/\.(cs|csproj|slnx|props|targets)$/) || has(/^apps\/sona\.server\//)) {
  gates.push({ label: "dotnet build apps/sona.server/sona.server.csproj", cmd: "dotnet", args: ["build", "apps/sona.server/sona.server.csproj"] });
}
if (!gates.length) process.exit(0);

// Fingerprint: branch diff + untracked file identity + which gates apply.
const h = createHash("sha256");
h.update(git(["diff", ref]).out);
for (const f of files) {
  try { const s = statSync(path.join(ROOT, f)); h.update(`${f}:${s.size}:${s.mtimeMs};`); } catch { h.update(`${f}:gone;`); }
}
h.update(gates.map((g) => g.label).join("|"));
const fp = h.digest("hex");
const cacheDir = path.join(ROOT, ".claude/.cache");
const cacheFile = path.join(cacheDir, "stop-gate.passed");
try { if (readFileSync(cacheFile, "utf8").trim() === fp) process.exit(0); } catch {}

const failures = [];
for (const g of gates) {
  const t0 = Date.now();
  const r = run(g.cmd, g.args);
  if (process.env.SONA_HOOK_DEBUG) process.stderr.write(`[stop-gate] ${g.label}: ${r.ok ? "ok" : "FAIL"} (${Math.round((Date.now() - t0) / 1000)}s)\n`);
  if (!r.ok) failures.push(`✗ ${g.label}\n${tail(r.out, 40)}`);
}

if (failures.length) {
  block(`AGENTS.md §4 Definition of Done not met — do not report the task done. Fix and re-verify:\n\n${failures.join("\n\n")}`);
}
mkdirSync(cacheDir, { recursive: true });
writeFileSync(cacheFile, fp);

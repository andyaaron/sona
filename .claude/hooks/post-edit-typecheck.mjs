// PostToolUse Edit|Write|MultiEdit (async) — AGENTS.md §0.6 / §6.2: run the
// narrowest typecheck (+ oxlint on web) for the package that was just edited.
// Exit 2 wakes the agent with the errors on stderr; the Stop gate is the backstop.
import { mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { readInput, rel, run, tail, ROOT } from "./lib.mjs";

const input = readInput();
const file = rel(input.tool_input?.file_path);
if (!file || !/\.(ts|tsx|mts|cts)$/.test(file)) process.exit(0);

const PKGS = [
  ["apps/sona.client/", "sona.client"],
  ["apps/mobile/", "mobile"],
  ["packages/shared/", "@sona/shared"],
  ["packages/api-client/", "@sona/api-client"],
];
const pkg = PKGS.find(([prefix]) => file.startsWith(prefix));
if (!pkg) process.exit(0);
const [, name] = pkg;

// One typecheck per package at a time; tsc -b writes tsbuildinfo and concurrent
// runs clobber each other. A stale lock (>3 min) is treated as dead.
const lock = path.join(ROOT, ".claude/.cache/typecheck", name.replace(/[@/]/g, "_"));
try {
  const age = Date.now() - statSync(lock).mtimeMs;
  if (age < 180_000) process.exit(0);
  rmSync(lock, { recursive: true, force: true });
} catch {}
mkdirSync(lock, { recursive: true });

const failures = [];
try {
  const tc = run("pnpm", ["--filter", name, "typecheck"]);
  if (!tc.ok) failures.push(`pnpm --filter ${name} typecheck FAILED:\n${tail(tc.out, 40)}`);
  if (name === "sona.client") {
    const lint = run("pnpm", ["--filter", name, "exec", "oxlint", path.relative("apps/sona.client", file)]);
    if (!lint.ok) failures.push(`oxlint ${file} FAILED:\n${tail(lint.out, 30)}`);
  }
} finally {
  rmSync(lock, { recursive: true, force: true });
}

if (failures.length) {
  process.stderr.write(`AGENTS.md §0.6: verify after every change — fix these before continuing.\n\n${failures.join("\n\n")}\n`);
  process.exit(2);
}

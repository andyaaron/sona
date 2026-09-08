// Shared helpers for Sona Claude Code hooks. Hooks receive JSON on stdin and
// reply with JSON on stdout; see AGENTS.md §8 for the rule each hook enforces.
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export function readInput() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export function deny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
  process.exit(0);
}

export function block(reason) {
  emit({ decision: "block", reason });
  process.exit(0);
}

// Repo-relative posix path, or null when the file lives outside the repo.
export function rel(filePath) {
  if (!filePath) return null;
  const abs = path.resolve(ROOT, filePath);
  const r = path.relative(ROOT, abs);
  if (r.startsWith("..") || path.isAbsolute(r)) return null;
  return r.split(path.sep).join("/");
}

export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: "1", FORCE_COLOR: "0", NO_COLOR: "1" },
    ...opts,
  });
  return {
    ok: res.status === 0,
    status: res.status,
    out: `${res.stdout || ""}${res.stderr || ""}`,
  };
}

export function git(args) {
  return run("git", args);
}

export function gitLines(args) {
  const r = git(args);
  return r.ok ? r.out.split("\n").map((s) => s.trim()).filter(Boolean) : [];
}

export function tail(text, n = 40) {
  // tsc/turbo colourise even without a TTY; the agent reads plain text.
  const plain = text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  const lines = plain.split("\n").filter((l) => l.trim());
  // dotnet/vitest bury the failure under warnings — surface error lines when present.
  const errors = lines.filter((l) => /\b(error|FAIL|✗|×)\b/.test(l) && !/\bwarning\b/.test(l));
  const pick = errors.length ? errors : lines;
  return pick.slice(-n).join("\n");
}

// Files touched by the current branch relative to main, plus uncommitted and
// untracked work. Used by the Stop gate to decide which checks are relevant.
export function changedFiles() {
  const base = git(["merge-base", "main", "HEAD"]);
  const ref = base.ok ? base.out.trim() : "HEAD";
  const set = new Set([
    ...gitLines(["diff", "--name-only", ref]),
    ...gitLines(["ls-files", "--others", "--exclude-standard"]),
  ]);
  return { ref, files: [...set] };
}

export function fileExists(p) {
  return existsSync(path.join(ROOT, p));
}

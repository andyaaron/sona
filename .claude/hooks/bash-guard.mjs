// PreToolUse Bash — mechanical AGENTS.md rules that show up as shell commands.
// Denies only; rewrites are left to the global rtk hook so two hooks never
// fight over updatedInput.
import { readInput, deny, gitLines } from "./lib.mjs";

const input = readInput();
const cmd = String(input.tool_input?.command || "");
if (!cmd.trim()) process.exit(0);

// §5.6 — the solution file is Sona.slnx. Scoped to a dotnet invocation so that
// prose mentioning the old name (docs, commit messages, heredocs) is not caught.
if (/\bdotnet\s+[^;&|\n]*\bSona\.sln\b(?!x)/.test(cmd)) {
  deny("AGENTS.md §5.6: the .NET solution is `Sona.slnx` (XML format) — `Sona.sln` does not exist. Re-run with Sona.slnx or the csproj path.");
}

// §2 — zsh expands an unquoted `*` in workspace specs.
if (/(^|\s)[^'"\s]*@workspace:\*(?=\s|$|;|&|\|)/.test(cmd)) {
  deny("AGENTS.md §2: quote workspace specs in zsh — e.g. pnpm --filter sona.client add '@sona/shared@workspace:*' (unquoted * breaks).");
}

// §2 — native / Expo packages go through `npx expo install` so versions match SDK 57.
const mobileScope = /pnpm\s+(?:--filter|-F)[= ]+mobile\b[^|;&]*\badd\b/.test(cmd)
  || /cd\s+(?:\.\/)?apps\/mobile\b[^|;&]*(?:&&|;)[^|;&]*\bpnpm\s+add\b/.test(cmd)
  || /pnpm\s+add\b[^|;&]*(?:--filter|-F)[= ]+mobile\b/.test(cmd);
if (mobileScope) {
  const NATIVE = /(^|\s)(expo|expo-[\w-]+|@expo\/[\w-]+|react-native|react-native-[\w-]+|@react-native(?:-[\w]+)?\/[\w-]+|@shopify\/react-native-[\w-]+)(@[^\s]+)?(?=\s|$)/;
  if (NATIVE.test(cmd)) {
    deny("AGENTS.md §2: never `pnpm add` a native/Expo package to mobile — use `cd apps/mobile && npx expo install <pkg>` so the version matches Expo SDK 57.");
  }
}

// §0.5 — TanStack Router does not run on React Native.
if (/@tanstack\/react-router/.test(cmd) && /\bmobile\b/.test(cmd)) {
  deny("AGENTS.md §0.5: TanStack Router does not work on React Native. Mobile routing is Expo Router.");
}

// §0.7 — protected files must not be rewritten from the shell either.
const PROTECTED_RE = /(\.npmrc|routeTree\.gen\.ts|expo-env\.d\.ts|pnpm-workspace\.yaml)\b/;
const WRITE_RE = /(\bsed\s+-[a-zA-Z]*i|\btee\b|\brm\b|\bmv\b|\btruncate\b|\bcp\b|(^|[^<>])>{1,2}\s*\S*(\.npmrc|routeTree\.gen\.ts|expo-env\.d\.ts|pnpm-workspace\.yaml))/;
if (PROTECTED_RE.test(cmd) && WRITE_RE.test(cmd)) {
  deny("AGENTS.md §0.7: .npmrc, pnpm-workspace.yaml, routeTree.gen.ts and expo-env.d.ts are protected. Read them freely; do not rewrite or delete them (pnpm-workspace.yaml may be edited with the Edit tool, which checks the lightningcss override).");
}

// git commit gates (§4, §6) — evaluated against what the commit would contain.
if (/\bgit\s+(?:[^\s;&|]+\s+)*commit\b/.test(cmd)) {
  const addsAll = /\bgit\s+add\b[^;&|]*(?:\s-A\b|\s--all\b|\s\.(?=\s|$))/.test(cmd); // git add -A / . → modified + untracked
  const commitAll = /\bcommit\b[^;&|]*(?:\s-a\b|\s--all\b|\s-am\b)/.test(cmd);          // commit -a → modified tracked only
  const addsSome = /\bgit\s+add\b/.test(cmd);
  const files = new Set(gitLines(["diff", "--cached", "--name-only"]));
  if (addsAll || commitAll) for (const f of gitLines(["diff", "--name-only"])) files.add(f);
  if (addsAll) for (const f of gitLines(["ls-files", "--others", "--exclude-standard"])) files.add(f);
  if (addsSome && !addsAll) {
    // Explicit paths after `git add` — best effort: take bare tokens that exist in the tree.
    const m = cmd.match(/\bgit\s+add\b([^;&|]*)/);
    if (m) for (const tok of m[1].split(/\s+/).filter((t) => t && !t.startsWith("-"))) files.add(tok.replace(/^['"]|['"]$/g, ""));
  }
  const list = [...files];

  // §6 — never commit .env files.
  const envFiles = list.filter((f) => /(^|\/)\.env(\.[^/]+)?$/.test(f) && !/\.(example|sample|template)$/.test(f));
  if (envFiles.length) {
    deny(`AGENTS.md §6: never commit .env files or secrets. Staged/added: ${envFiles.join(", ")}. Unstage them (git restore --staged <file>) before committing.`);
  }

  // §4 — admin UI changes update docs/admin-ui-guide.md in the same commit.
  const touchesAdmin = list.some((f) => f.startsWith("apps/sona.client/src/") && !/\.test\.tsx?$/.test(f) && !f.endsWith("routeTree.gen.ts"));
  const touchesGuide = list.includes("docs/admin-ui-guide.md");
  const declaresNoUiChange = /no user-visible change/i.test(cmd);
  if (touchesAdmin && !touchesGuide && !declaresNoUiChange) {
    deny("AGENTS.md §4: this commit touches apps/sona.client/src/** but not docs/admin-ui-guide.md. Either update the guide in the same commit (new/moved/renamed controls, click paths, dialogs, toasts, empty states, role gates, data-testids) or, if nothing a user could notice changed, include the phrase \"no user-visible change\" in the commit message.");
  }
}

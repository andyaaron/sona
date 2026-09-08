// PostToolUse Edit|Write|MultiEdit — fast static checks on the file just written.
// Each check maps to an AGENTS.md rule; violations are fed back to the agent.
import { readFileSync } from "node:fs";
import path from "node:path";
import { readInput, block, rel, ROOT } from "./lib.mjs";

const input = readInput();
const file = rel(input.tool_input?.file_path);
if (!file) process.exit(0);

let src;
try { src = readFileSync(path.join(ROOT, file), "utf8"); } catch { process.exit(0); }

const problems = [];
const isTs = /\.(ts|tsx|mts|cts)$/.test(file) && !file.endsWith(".d.ts");
const isCss = /\.css$/.test(file);
const app = file.startsWith("apps/sona.client/") ? "web" : file.startsWith("apps/mobile/") ? "mobile" : null;

// §1 — env vars are read only in src/config/env.ts.
if (isTs && !/\/src\/config\/env\.ts$/.test(file) && !/(^|\/)(vite|vitest|playwright|metro|babel)\.config\.[cm]?ts$/.test(file)) {
  if (/import\.meta\.env\b/.test(src)) problems.push("AGENTS.md §1: `import.meta.env` may only be read in apps/sona.client/src/config/env.ts — import `env` from `@/config/env` instead.");
  if (/process\.env\.EXPO_PUBLIC_/.test(src)) problems.push("AGENTS.md §1: `process.env.EXPO_PUBLIC_*` may only be read in apps/mobile/src/config/env.ts — import `env` from `@/config/env` instead.");
}

// §0.3 — bulletproof-react dependency direction.
if (isTs && app) {
  const specs = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const featOf = (p) => (p.match(/\/src\/features\/([^/]+)\//) || [])[1];
  const myFeature = featOf(`/${file}`);
  const srcRoot = file.replace(/\/src\/.*$/, "/src");
  for (const spec of specs) {
    if (app === "mobile" && spec.startsWith("@tanstack/react-router")) {
      problems.push("AGENTS.md §0.5: TanStack Router does not work on React Native — use Expo Router in apps/mobile.");
    }
    let target = null;
    if (spec.startsWith("@/")) target = `${srcRoot}/${spec.slice(2)}`;
    else if (spec.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
    if (!target) continue;
    const targetFeature = featOf(`/${target}/`);
    if (myFeature && targetFeature && targetFeature !== myFeature) {
      problems.push(`AGENTS.md §0.3: feature "${myFeature}" imports from feature "${targetFeature}" (${spec}). A feature must never import from another feature — move shared code down into components/, hooks/, lib/ or utils/.`);
    }
    if (!myFeature && targetFeature && /\/src\/(components|hooks|lib|utils|stores|config)\//.test(`/${file}`)) {
      problems.push(`AGENTS.md §0.3: ${file} imports from a feature (${spec}). Dependencies point one way: app/ → features/ → (components/, hooks/, lib/, utils/) — shared code must not import features.`);
    }
  }
}

// §4 — every literal data-testid in the admin is registered in docs/admin-ui-guide.md.
if (app === "web" && /\.tsx$/.test(file) && !/\.test\.tsx$/.test(file) && !file.includes("/src/testing/")) {
  let guide = "";
  try { guide = readFileSync(path.join(ROOT, "docs/admin-ui-guide.md"), "utf8"); } catch {}
  const ids = [...new Set([...src.matchAll(/data-testid=["']([^"'{}$]+)["']/g)].map((m) => m[1]))];
  const missing = ids.filter((id) => !guide.includes(`\`${id}\``) && !guide.includes(`"${id}"`));
  if (missing.length) {
    problems.push(`AGENTS.md §4 / admin-ui-guide: data-testid(s) not registered in docs/admin-ui-guide.md: ${missing.join(", ")}. Add each to the page → region section where the control lives (a testid that is not in the guide is a bug).`);
  }
}

// §3 — Tailwind v4 syntax on web.
if (isCss && app === "web" && /^\s*@tailwind\s/m.test(src)) {
  problems.push("AGENTS.md §3: Tailwind v4 uses `@import \"tailwindcss\"` — the `@tailwind base/components/utilities` directives are v3 syntax.");
}

if (problems.length) block(`${file}:\n- ${problems.join("\n- ")}`);

// Which changed paths require a plugin version bump (#55).
//
// Consumers cache the installed plugin under its version string and only update when it changes, so
// any change to content a consumer reads must move the version. The installed "marketplace" entry is
// a FULL GIT CLONE of this repo, not just skills/ and hooks/. A consumer's session reads:
//
//   - skills/, hooks/, .claude-plugin/   the plugin proper
//   - .agents/, templates/               the Codex skills and AGENTS.md template, copied from the clone
//   - controls/                          the registry the skills point at ("link controls/registry.yaml
//                                         as the validation anchor"), the example profiles, the schemas
//   - docs/                              the compliance model and architecture the skills cite
//
// The earlier rule watched only the first line, on the premise that docs/ and controls/ "are read in
// the repo, not resolved from the installed cache". That was false: a consumer read a stale
// docs/compliance-model.md and a mislabelled CSA pin from a cache three registry corrections behind,
// because #45-#47 touched only controls/ and docs/ and so never moved the version (#55).
//
// Excluded: docs/plans/ and docs/compliance/ are this repo's own SDLC evidence (plans of record,
// change records, release packs). Every change adds one; requiring a bump for them would be noise,
// and no consumer skill reads them.
//
// Usage: git diff --name-only BASE HEAD | node --experimental-strip-types controls/scripts/version-guard.ts
// Prints the changed paths that require a bump, one per line (nothing if none).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DISTRIBUTED_PREFIXES = ["skills/", "hooks/", ".claude-plugin/", ".agents/", "templates/", "controls/", "docs/"];
export const EXCLUDED_PREFIXES = ["docs/plans/", "docs/compliance/"];

export function requiresBump(path: string): boolean {
  if (EXCLUDED_PREFIXES.some((p) => path.startsWith(p))) return false;
  return DISTRIBUTED_PREFIXES.some((p) => path.startsWith(p));
}

export function distributedChanges(paths: string[]): string[] {
  return paths.map((p) => p.trim()).filter((p) => p !== "" && requiresBump(p));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  for (const p of distributedChanges(readFileSync(0, "utf8").split("\n"))) console.log(p);
}

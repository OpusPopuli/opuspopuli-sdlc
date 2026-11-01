// The consuming-repo compliance profile contract (#10).
//
// A consuming repo declares a profile at .sdlc/compliance-profile.yaml (#56; formerly
// .claude/compliance-profile.yaml, still read as a legacy fallback) naming the framework families
// that apply to it. resolveProfile() computes the active-vs-inert partition: controls, data
// classes, and evidence obligations that are live for that repo — everything else is inert. This
// is the CODE layer of "inertness"; the skills honor the resolved profile at the INSTRUCTION layer
// (they are prose, not a runtime sandbox).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { CONTROLS_DIR, type Registry, type Control } from "./registry.ts";

export interface Profile {
  version: number;
  repo?: string;
  families: string[];
  applicability?: string[];
}

export interface ResolvedProfile {
  repo: string;
  activeFamilies: string[];
  activeControls: Control[];
  inertControls: Control[];
  activeDataClasses: string[];
  activeEvidence: string[];
}

// The default when a consuming repo declares no profile: framework-agnostic lifecycle only.
// No declared families, so every framework-conditional control is inert; the unconditional lifecycle
// behaviors (plans, change records, traceability) run, and so do the registry's always-on families.
export const NO_PROFILE: Profile = { version: 1, repo: "(no compliance profile declared)", families: [] };

// Families active for every repo whatever its profile declares (#50): controls about using this
// SDLC at all, such as AI tool qualification, cannot be opted out of by declaring a narrow profile.
export function alwaysOnFamilies(reg: Registry): string[] {
  return reg.profiles.always_on ?? [];
}

export function resolveProfile(reg: Registry, profile: Profile): ResolvedProfile {
  const active = new Set([...profile.families, ...alwaysOnFamilies(reg)]);
  const activeControls = reg.controls.filter((c) => active.has(c.family));
  const inertControls = reg.controls.filter((c) => !active.has(c.family));

  const dataClasses = new Set<string>();
  for (const fam of active) {
    for (const dc of reg.frameworks[fam]?.data_classes ?? []) dataClasses.add(dc);
  }

  const evidence = new Set<string>();
  for (const c of activeControls) for (const e of c.evidence ?? []) evidence.add(e);

  return {
    repo: profile.repo ?? NO_PROFILE.repo!,
    activeFamilies: [...active].sort(),
    activeControls,
    inertControls,
    activeDataClasses: [...dataClasses].sort(),
    activeEvidence: [...evidence].sort(),
  };
}

export interface ProfileFinding {
  level: "error" | "warning";
  message: string;
}

// Validate a profile against the registry: declared families must exist; narrowing applicability
// values should be used by some active control (warning, not error — open vocabulary).
export function validateProfile(reg: Registry, profile: unknown): ProfileFinding[] {
  const findings: ProfileFinding[] = [];
  const p = profile as Partial<Profile>;

  if (p.version !== 1) findings.push({ level: "error", message: `version must be 1 (got ${p.version})` });
  if (!Array.isArray(p.families) || p.families.length === 0) {
    findings.push({ level: "error", message: "families must be a non-empty array" });
    return findings;
  }

  const known = new Set(reg.profiles.families);
  const alwaysOn = new Set(alwaysOnFamilies(reg));
  for (const fam of p.families) {
    if (!known.has(fam)) {
      findings.push({ level: "error", message: `family "${fam}" is not a registry family (profiles.families)` });
    } else if (alwaysOn.has(fam)) {
      findings.push({ level: "warning", message: `family "${fam}" is always on; declaring it is redundant` });
    }
  }

  if (Array.isArray(p.applicability)) {
    const resolved = resolveProfile(reg, p as Profile);
    const activeApplicability = new Set(resolved.activeControls.flatMap((c) => c.applicability));
    for (const a of p.applicability) {
      if (!activeApplicability.has(a)) {
        findings.push({
          level: "warning",
          message: `applicability "${a}" is used by no active control (typo, or its pack has not landed yet)`,
        });
      }
    }
  }

  return findings;
}

export function loadProfile(path: string): Profile {
  return parse(readFileSync(path, "utf8")) as Profile;
}

// Example profiles committed in this repo, validated by `npm run check` so the contract can't rot.
export const EXAMPLE_PROFILES_DIR = join(CONTROLS_DIR, "examples");

// Where a consuming repo keeps its profile (#56). The canonical path belongs to no agent runtime:
// the profile is the authoritative compliance configuration, and Claude Code and Codex must read
// the same file. The legacy path is still honored so existing consumers keep working, but it is
// reported as deprecated, never silently accepted.
export const PROFILE_PATH = ".sdlc/compliance-profile.yaml";
export const LEGACY_PROFILE_PATH = ".claude/compliance-profile.yaml";

export interface ProfileLocation {
  // Absolute path of the profile to use, or null when the repo declares none.
  path: string | null;
  // Which location it came from. "none" means the NO_PROFILE default applies.
  source: "canonical" | "legacy" | "none";
  // Human-readable notes a caller must surface: deprecation, or a shadowed duplicate.
  notices: string[];
}

// Resolution order: canonical, then legacy. When both exist the canonical file wins and the
// duplicate is reported — two profiles that can drift apart are a defect, not a convenience.
export function findProfile(repoRoot: string): ProfileLocation {
  const canonical = join(repoRoot, PROFILE_PATH);
  const legacy = join(repoRoot, LEGACY_PROFILE_PATH);
  const hasCanonical = existsSync(canonical);
  const hasLegacy = existsSync(legacy);

  if (hasCanonical) {
    const notices = hasLegacy
      ? [`${LEGACY_PROFILE_PATH} is ignored because ${PROFILE_PATH} exists; delete the legacy copy`]
      : [];
    return { path: canonical, source: "canonical", notices };
  }
  if (hasLegacy) {
    return {
      path: legacy,
      source: "legacy",
      notices: [`${LEGACY_PROFILE_PATH} is deprecated; move it to ${PROFILE_PATH}`],
    };
  }
  return { path: null, source: "none", notices: [] };
}

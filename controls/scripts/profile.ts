// The consuming-repo compliance profile contract (#10).
//
// A consuming repo declares a profile (conventionally .claude/compliance-profile.yaml) naming the
// framework families that apply to it. resolveProfile() computes the active-vs-inert partition:
// controls, data classes, and evidence obligations that are live for that repo — everything else
// is inert. This is the CODE layer of "inertness"; the skills honor the resolved profile at the
// INSTRUCTION layer (they are prose, not a runtime sandbox).
import { readFileSync } from "node:fs";
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
// No framework families are active, so every framework-conditional control is inert; only the
// unconditional lifecycle behaviors (plans, change records, traceability) run.
export const NO_PROFILE: Profile = { version: 1, repo: "(no compliance profile declared)", families: [] };

export function resolveProfile(reg: Registry, profile: Profile): ResolvedProfile {
  const active = new Set(profile.families);
  const activeControls = reg.controls.filter((c) => active.has(c.family));
  const inertControls = reg.controls.filter((c) => !active.has(c.family));

  const dataClasses = new Set<string>();
  for (const fam of profile.families) {
    for (const dc of reg.frameworks[fam]?.data_classes ?? []) dataClasses.add(dc);
  }

  const evidence = new Set<string>();
  for (const c of activeControls) for (const e of c.evidence ?? []) evidence.add(e);

  return {
    repo: profile.repo ?? NO_PROFILE.repo!,
    activeFamilies: [...profile.families].sort(),
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
  for (const fam of p.families) {
    if (!known.has(fam)) {
      findings.push({ level: "error", message: `family "${fam}" is not a registry family (profiles.families)` });
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

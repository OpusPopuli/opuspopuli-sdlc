import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "./registry.ts";
import {
  resolveProfile,
  validateProfile,
  loadProfile,
  findProfile,
  NO_PROFILE,
  EXAMPLE_PROFILES_DIR,
  PROFILE_PATH,
  LEGACY_PROFILE_PATH,
} from "./profile.ts";
import { join, dirname } from "node:path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const reg = loadRegistry();

// Headline acceptance test: the Opus Populi launch profile activates its declared families —
// including the CCPA controls (#8) — and leaves everything else inert.
test("Opus Populi profile activates CCPA + SOC 2 controls, leaves HIPAA/Part 11/GxP/ISO inert", () => {
  const profile = loadProfile(join(EXAMPLE_PROFILES_DIR, "opuspopuli.compliance-profile.yaml"));
  const r = resolveProfile(reg, profile);

  assert.deepEqual(r.activeFamilies, ["sdlc-core", "soc2", "us-state-privacy"]);

  // SOC 2 and all four CCPA controls are active.
  const activeIds = new Set(r.activeControls.map((c) => c.id));
  for (const id of ["CTL-SOC2-001", "CTL-CCPA-001", "CTL-CCPA-002", "CTL-CCPA-003", "CTL-CCPA-004", "CTL-AIQ-001"]) {
    assert.ok(activeIds.has(id), `${id} should be active for the Opus Populi profile`);
  }
  // Every HIPAA, Part 11, GxP, and ISO control is inert.
  const inertIds = new Set(r.inertControls.map((c) => c.id));
  for (const id of ["CTL-HIPAA-001", "CTL-HIPAA-002", "CTL-HIPAA-004", "CTL-HIPAA-005", "CTL-HIPAA-006", "CTL-P11-001", "CTL-P11-002", "CTL-CSA-001", "CTL-ISO-001"]) {
    assert.ok(inertIds.has(id), `${id} should be inert for the CCPA-only profile`);
  }
  // No HIPAA control leaks into the active set.
  assert.ok(!r.activeControls.some((c) => c.family === "hipaa"));
  // The CCPA data class is now active; PHI is not.
  assert.deepEqual(r.activeDataClasses, ["ca-personal-information"]);
});

test("a HIPAA/GxP profile activates PHI data class and Part 11 controls", () => {
  const profile = loadProfile(join(EXAMPLE_PROFILES_DIR, "hipaa-gxp.compliance-profile.yaml"));
  const r = resolveProfile(reg, profile);
  assert.ok(r.activeDataClasses.includes("phi-pii"));
  assert.ok(r.activeControls.some((c) => c.id === "CTL-P11-001"));
  assert.ok(r.inertControls.some((c) => c.id === "CTL-ISO-001")); // iso-medical not declared
});

test("the no-profile default leaves every framework control inert, but always-on controls apply", () => {
  const r = resolveProfile(reg, NO_PROFILE);
  assert.deepEqual(r.activeControls.map((c) => c.id), ["CTL-AIQ-001"]);
  assert.ok(r.activeControls.every((c) => c.family === "sdlc-core"));
  assert.deepEqual(r.activeDataClasses, []);
  assert.equal(r.inertControls.length, reg.controls.length - 1);
});

// #50: AI tool qualification applies to every adopter, because every adopter is AI-assisted.
test("CTL-AIQ-001 is active for every profile, however narrow", () => {
  for (const families of [[], ["soc2"], ["us-state-privacy"], ["pci-dss"], ["hipaa", "part11"]]) {
    const r = resolveProfile(reg, { version: 1, families });
    assert.ok(r.activeControls.some((c) => c.id === "CTL-AIQ-001"), `inert for [${families.join(", ")}]`);
  }
});

test("declaring an always-on family is a warning, not an error", () => {
  const findings = validateProfile(reg, { version: 1, families: ["sdlc-core", "soc2"] });
  assert.deepEqual(findings.filter((f) => f.level === "error"), []);
  assert.ok(findings.some((f) => f.level === "warning" && /always on/.test(f.message)));
});

test("a profile declaring an unknown family is an error", () => {
  const findings = validateProfile(reg, { version: 1, families: ["not-a-family"] });
  assert.ok(findings.some((f) => f.level === "error" && /not a registry family/.test(f.message)));
});

test("both committed example profiles validate without errors", () => {
  for (const name of ["opuspopuli.compliance-profile.yaml", "hipaa-gxp.compliance-profile.yaml", "payments.compliance-profile.yaml"]) {
    const findings = validateProfile(reg, loadProfile(join(EXAMPLE_PROFILES_DIR, name)));
    assert.deepEqual(findings.filter((f) => f.level === "error"), [], `${name} should have no errors`);
  }
});

test("applicability that no active control uses is a warning, not an error", () => {
  // A made-up applicability value warns but does not error (open vocabulary).
  const findings = validateProfile(reg, { version: 1, families: ["us-state-privacy"], applicability: ["not-a-real-context"] });
  assert.deepEqual(findings.filter((f) => f.level === "error"), []);
  assert.ok(findings.some((f) => f.level === "warning"));
});

test("the Opus Populi example profile now validates with no warnings (CCPA controls landed)", () => {
  const profile = loadProfile(join(EXAMPLE_PROFILES_DIR, "opuspopuli.compliance-profile.yaml"));
  const findings = validateProfile(reg, profile);
  assert.deepEqual(findings, [], "ca-personal-information is now used by active CCPA controls");
});

test("resolve partitions every control into exactly active or inert", () => {
  const r = resolveProfile(reg, { version: 1, families: ["soc2"] });
  assert.equal(r.activeControls.length + r.inertControls.length, reg.controls.length);
});

// findProfile (#56). Fixtures live in a temp dir, never the working tree (see the note on
// reconcileImplementedBy in reconcile.ts for why that matters).
function repoWith(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "sdlc-profile-"));
  for (const p of paths) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), "version: 1\nfamilies: [soc2]\n");
  }
  return root;
}

test("findProfile prefers the agent-neutral .sdlc/ path", () => {
  const root = repoWith([PROFILE_PATH]);
  try {
    const loc = findProfile(root);
    assert.equal(loc.source, "canonical");
    assert.equal(loc.path, join(root, PROFILE_PATH));
    assert.deepEqual(loc.notices, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findProfile still reads the legacy .claude/ path, and says it is deprecated", () => {
  const root = repoWith([LEGACY_PROFILE_PATH]);
  try {
    const loc = findProfile(root);
    assert.equal(loc.source, "legacy");
    assert.equal(loc.path, join(root, LEGACY_PROFILE_PATH));
    assert.ok(loc.notices.some((n) => /deprecated/.test(n) && n.includes(PROFILE_PATH)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findProfile: with both present the canonical file wins and the duplicate is reported", () => {
  const root = repoWith([PROFILE_PATH, LEGACY_PROFILE_PATH]);
  try {
    const loc = findProfile(root);
    assert.equal(loc.source, "canonical");
    assert.ok(loc.notices.some((n) => /ignored/.test(n)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("findProfile with no profile returns none, so the NO_PROFILE default applies", () => {
  const root = repoWith([]);
  try {
    assert.deepEqual(findProfile(root), { path: null, source: "none", notices: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the canonical profile path belongs to no agent runtime", () => {
  assert.ok(!PROFILE_PATH.startsWith(".claude/") && !PROFILE_PATH.startsWith(".agents/"));
});

// HITECH (#65): the breach-readiness, encryption and business-associate controls ride the hipaa family.
test("a HIPAA profile activates the HITECH controls", () => {
  const r = resolveProfile(reg, { version: 1, families: ["hipaa"] });
  const ids = new Set(r.activeControls.map((c) => c.id));
  for (const id of ["CTL-HIPAA-004", "CTL-HIPAA-005", "CTL-HIPAA-006"]) assert.ok(ids.has(id), id);
  assert.equal(reg.frameworks.hipaa.label, "HIPAA / HITECH");
});

// PCI DSS (#67): the payments example activates the card-data classes and the five PCI controls.
test("the payments profile activates PCI DSS controls and card-data classes, and nothing health-related", () => {
  const r = resolveProfile(reg, loadProfile(join(EXAMPLE_PROFILES_DIR, "payments.compliance-profile.yaml")));
  assert.deepEqual(r.activeDataClasses, ["cardholder-data", "sensitive-authentication-data"]);
  const ids = new Set(r.activeControls.map((c) => c.id));
  for (const id of ["CTL-PCI-001", "CTL-PCI-002", "CTL-PCI-003", "CTL-PCI-004", "CTL-PCI-005", "CTL-SOC2-001"]) {
    assert.ok(ids.has(id), id);
  }
  assert.ok(!r.activeControls.some((c) => c.family === "hipaa" || c.family === "part11"));
  assert.deepEqual(validateProfile(reg, loadProfile(join(EXAMPLE_PROFILES_DIR, "payments.compliance-profile.yaml"))), []);
});

test("PCI DSS is cited by requirement number only (copyrighted)", () => {
  for (const c of reg.controls.filter((c) => c.family === "pci-dss")) {
    assert.ok(c.citations.every((cit) => cit.adapter === "clause"), `${c.id} must use the clause adapter`);
  }
});

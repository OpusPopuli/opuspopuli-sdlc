import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "./registry.ts";
import { resolveProfile, validateProfile, loadProfile, NO_PROFILE, EXAMPLE_PROFILES_DIR } from "./profile.ts";
import { join } from "node:path";

const reg = loadRegistry();

// Headline acceptance test: the Opus Populi launch profile activates its declared families —
// including the CCPA controls (#8) — and leaves everything else inert.
test("Opus Populi profile activates CCPA + SOC 2 controls, leaves HIPAA/Part 11/GxP/ISO inert", () => {
  const profile = loadProfile(join(EXAMPLE_PROFILES_DIR, "opuspopuli.compliance-profile.yaml"));
  const r = resolveProfile(reg, profile);

  assert.deepEqual(r.activeFamilies, ["soc2", "us-state-privacy"]);

  // SOC 2 and all four CCPA controls are active.
  const activeIds = new Set(r.activeControls.map((c) => c.id));
  for (const id of ["CTL-SOC2-001", "CTL-CCPA-001", "CTL-CCPA-002", "CTL-CCPA-003", "CTL-CCPA-004"]) {
    assert.ok(activeIds.has(id), `${id} should be active for the Opus Populi profile`);
  }
  // Every HIPAA, Part 11, GxP, and ISO control is inert.
  const inertIds = new Set(r.inertControls.map((c) => c.id));
  for (const id of ["CTL-HIPAA-001", "CTL-HIPAA-002", "CTL-P11-001", "CTL-P11-002", "CTL-CSA-001", "CTL-AIQ-001", "CTL-ISO-001"]) {
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

test("the no-profile default leaves every framework control inert", () => {
  const r = resolveProfile(reg, NO_PROFILE);
  assert.deepEqual(r.activeControls, []);
  assert.deepEqual(r.activeDataClasses, []);
  assert.equal(r.inertControls.length, reg.controls.length);
});

test("a profile declaring an unknown family is an error", () => {
  const findings = validateProfile(reg, { version: 1, families: ["not-a-family"] });
  assert.ok(findings.some((f) => f.level === "error" && /not a registry family/.test(f.message)));
});

test("both committed example profiles validate without errors", () => {
  for (const name of ["opuspopuli.compliance-profile.yaml", "hipaa-gxp.compliance-profile.yaml"]) {
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "./registry.ts";
import { resolveProfile, validateProfile, loadProfile, NO_PROFILE, EXAMPLE_PROFILES_DIR } from "./profile.ts";
import { join } from "node:path";

const reg = loadRegistry();

// Headline acceptance test: the Opus Populi launch profile activates only its declared families and
// leaves everything else inert.
test("Opus Populi profile activates us-state-privacy + soc2, leaves HIPAA/Part 11/GxP/ISO inert", () => {
  const profile = loadProfile(join(EXAMPLE_PROFILES_DIR, "opuspopuli.compliance-profile.yaml"));
  const r = resolveProfile(reg, profile);

  assert.deepEqual(r.activeFamilies, ["soc2", "us-state-privacy"]);

  // SOC 2 controls are active.
  assert.ok(r.activeControls.some((c) => c.id === "CTL-SOC2-001"));
  // Every HIPAA, Part 11, GxP, and ISO control is inert.
  const inertIds = new Set(r.inertControls.map((c) => c.id));
  for (const id of ["CTL-HIPAA-001", "CTL-HIPAA-002", "CTL-P11-001", "CTL-P11-002", "CTL-CSA-001", "CTL-AIQ-001", "CTL-ISO-001"]) {
    assert.ok(inertIds.has(id), `${id} should be inert for the CCPA-only profile`);
  }
  // No HIPAA control leaks into the active set.
  assert.ok(!r.activeControls.some((c) => c.family === "hipaa"));
  // us-state-privacy has no controls yet (#8), so no CCPA data classes are active yet.
  assert.deepEqual(r.activeDataClasses, []);
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
  // ca-personal-information has no control until #8, so the Opus Populi profile warns but passes.
  const findings = validateProfile(reg, { version: 1, families: ["us-state-privacy"], applicability: ["ca-personal-information"] });
  assert.deepEqual(findings.filter((f) => f.level === "error"), []);
  assert.ok(findings.some((f) => f.level === "warning"));
});

test("resolve partitions every control into exactly active or inert", () => {
  const r = resolveProfile(reg, { version: 1, families: ["soc2"] });
  assert.equal(r.activeControls.length + r.inertControls.length, reg.controls.length);
});

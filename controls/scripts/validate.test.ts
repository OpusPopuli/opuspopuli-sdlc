import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { validateRegistry } from "./validate.ts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");

function loadRegistry(): any {
  return parse(readFileSync(join(REPO_ROOT, "controls", "registry.yaml"), "utf8"));
}

test("the seed registry validates clean", () => {
  const findings = validateRegistry(loadRegistry(), { repoRoot: REPO_ROOT });
  assert.deepEqual(findings, []);
});

// Risk-register item 1 (#1 plan): the schema must already fit the extension packs.
// A GDPR-shaped entry (eurlex citation, EU jurisdiction/applicability) validates without any
// schema change — if this passes, #7-#9 fit.
test("GDPR dry-run entry fits the schema unchanged", () => {
  const reg = loadRegistry();
  reg.profiles.families.push("gdpr");
  reg.controls.push({
    id: "CTL-GDPR-001",
    title: "Breach notification within 72 hours of awareness",
    family: "gdpr",
    jurisdiction: "eu",
    applicability: ["eu-personal-data"],
    citations: [
      {
        adapter: "eurlex",
        celex: "32016R0679",
        article: "Art. 33",
        pinned: { consolidation_date: "2016-05-04", checked: "2026-07-30" },
      },
    ],
    implemented_by: [{ type: "skill", ref: "op-hotfix" }],
    evidence: ["docs/compliance/incidents/*.md"],
    status: "active",
  });
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.deepEqual(findings, []);
});

test("duplicate control ids are rejected", () => {
  const reg = loadRegistry();
  reg.controls.push({ ...reg.controls[0] });
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.includes("duplicate control id")));
});

test("undeclared family is rejected", () => {
  const reg = loadRegistry();
  reg.controls[0].family = "made-up-family";
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.includes("not declared in profiles.families")));
});

test("implemented_by skill must exist on disk", () => {
  const reg = loadRegistry();
  reg.controls[0].implemented_by.push({ type: "skill", ref: "op-nonexistent" });
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.includes("op-nonexistent")));
});

// The no-vendoring boundary: a clause citation carrying body text is a schema violation.
test("clause citations cannot carry vendored text", () => {
  const reg = loadRegistry();
  const soc2 = reg.controls.find((c: any) => c.id === "CTL-SOC2-001");
  soc2.citations[0].text = "The entity authorizes, designs, develops or acquires...";
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.startsWith("schema:")));
});

test("active status with unpinned pinnable citation is rejected", () => {
  const reg = loadRegistry();
  const hipaa = reg.controls.find((c: any) => c.id === "CTL-HIPAA-001");
  hipaa.status = "active";
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.includes('must be "pin-pending"')));
});

test("pin-pending status with everything pinned is rejected", () => {
  const reg = loadRegistry();
  const p11 = reg.controls.find((c: any) => c.id === "CTL-P11-001");
  p11.citations[0].pinned = { amendment_date: "2024-01-01", checked: "2026-07-30" };
  const findings = validateRegistry(reg, { repoRoot: REPO_ROOT });
  assert.ok(findings.some((f) => f.message.includes('must be "active"')));
});

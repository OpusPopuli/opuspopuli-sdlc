import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistry } from "./registry.ts";
import { reconcile, normalizeEvidencePath } from "./reconcile.ts";

// Write a throwaway markdown file and reconcile it against the real registry.
function fileWith(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "reconcile-"));
  const f = join(dir, "SKILL.md");
  writeFileSync(f, content);
  return f;
}

test("a real control ID and declared evidence path reconcile clean", () => {
  const reg = loadRegistry();
  const file = fileWith(
    "Implements CTL-P11-001. Writes docs/compliance/traceability/<issue>-rtm.md."
  );
  assert.deepEqual(reconcile(reg, [file]), []);
});

test("an unknown control ID is flagged", () => {
  const reg = loadRegistry();
  const file = fileWith("Implements CTL-BOGUS-999.");
  const findings = reconcile(reg, [file]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /unknown control CTL-BOGUS-999/);
});

test("an evidence path no control declares is flagged", () => {
  const reg = loadRegistry();
  const file = fileWith("Writes docs/compliance/invented/<issue>-thing.md as evidence.");
  const findings = reconcile(reg, [file]);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /no control declares/);
});

test("placeholder and glob forms of an evidence path normalize equal", () => {
  assert.equal(
    normalizeEvidencePath("docs/compliance/changes/<issue>-change-record.md"),
    normalizeEvidencePath("docs/compliance/changes/*-change-record.md")
  );
});

test("multiple valid control IDs in one file all pass", () => {
  const reg = loadRegistry();
  const file = fileWith("See CTL-CSA-001 and CTL-AIQ-001.");
  assert.deepEqual(reconcile(reg, [file]), []);
});

test("multiple findings in one file are all reported", () => {
  const reg = loadRegistry();
  const file = fileWith("CTL-NOPE-001 and docs/compliance/ghost/x.md both wrong.");
  const findings = reconcile(reg, [file]);
  assert.equal(findings.length, 2);
});

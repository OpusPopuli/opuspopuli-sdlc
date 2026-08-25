import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadRegistry, CONTROLS_DIR } from "./registry.ts";
import { reconcile, reconcileImplementedBy, normalizeEvidencePath } from "./reconcile.ts";

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

// --- forward implemented_by check (#48) ------------------------------------
//
// The reverse check (above) catches a skill citing a control that doesn't exist. Nothing caught the
// opposite: the registry naming a skill that never mentions the control. All 19 claims were in that
// state — the registry's own traceability links weren't traceable.

// Lay out a synthetic repo in a TEMP dir and return [root, files]. Never writes to the working tree:
// an earlier version of this helper rooted itself at the real repo and clobbered two committed skills.
function repoWith(files: Record<string, string>): [string, string[]] {
  const root = mkdtempSync(join(tmpdir(), "reconcile-repo-"));
  const out: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
    out.push(full);
  }
  return [root, out];
}

test("a skill that cites the control the registry claims for it reconciles clean", () => {
  const reg = loadRegistry();
  const only = {
    ...reg,
    controls: [{ ...reg.controls.find((c) => c.id === "CTL-P11-001")! }],
  };
  const [root, files] = repoWith({ "skills/op-trace/SKILL.md": "Implements CTL-P11-001." });
  assert.deepEqual(reconcileImplementedBy(only as never, files, root), []);
});

test("a registry claim the named skill never cites is flagged", () => {
  const reg = loadRegistry();
  const only = { ...reg, controls: [{ ...reg.controls.find((c) => c.id === "CTL-P11-001")! }] };
  const [root, files] = repoWith({ "skills/op-trace/SKILL.md": "Builds a traceability matrix." });
  const findings = reconcileImplementedBy(only as never, files, root);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /CTL-P11-001 claims this skill implements it/);
  assert.match(findings[0].message, /never cites CTL-P11-001/);
});

test("a registry claim naming a skill file that does not exist is flagged", () => {
  const reg = loadRegistry();
  const only = { ...reg, controls: [{ ...reg.controls.find((c) => c.id === "CTL-P11-001")! }] };
  const [root] = repoWith({});
  const findings = reconcileImplementedBy(only as never, [], root);
  assert.equal(findings.length, 1);
  assert.match(findings[0].message, /does not exist/);
});

test("architecture refs are exempt — posture has no file to check", () => {
  const reg = loadRegistry();
  // CTL-HIPAA-002 is implemented by an architecture ref plus two skills.
  const only = { ...reg, controls: [{ ...reg.controls.find((c) => c.id === "CTL-HIPAA-002")! }] };
  const [root, files] = repoWith({
    "skills/op-review/SKILL.md": "CTL-HIPAA-002",
    "skills/op-validate/SKILL.md": "CTL-HIPAA-002",
  });
  assert.deepEqual(reconcileImplementedBy(only as never, files, root), []);
});

test("the committed repo satisfies the forward check (regression guard for #48)", () => {
  // The state this issue found: 19 claims, 0 cited. This test is what keeps it from returning.
  const reg = loadRegistry();
  const root = join(CONTROLS_DIR, "..");
  const files: string[] = [];
  for (const control of reg.controls) {
    for (const impl of control.implemented_by ?? []) {
      if (impl.type === "skill") files.push(join(root, `skills/${impl.ref}/SKILL.md`));
      if (impl.type === "hook") files.push(join(root, `hooks/${impl.ref}.md`));
    }
  }
  assert.deepEqual(reconcileImplementedBy(reg, [...new Set(files)]), []);
});

test("op-validate carries the AI-qualification section CTL-AIQ-001 claims it produces", () => {
  // The registry said op-validate records model/plugin version, gating and data-handling posture.
  // The skill said nothing about any of it (#48).
  const text = readFileSync(join(CONTROLS_DIR, "..", "skills/op-validate/SKILL.md"), "utf8");
  assert.match(text, /AI tool qualification/i);
  assert.match(text, /Model and version/i);
  assert.match(text, /plugin version/i);
  assert.match(text, /Data-handling posture/i);
});

test("op-hotfix gates the production change itself, not only its follow-ups", () => {
  const text = readFileSync(join(CONTROLS_DIR, "..", "skills/op-hotfix/SKILL.md"), "utf8");
  assert.match(text, /show me the diff before committing/i);
  assert.match(text, /Emergency deviation/i); // and the deviation is recorded, not silent
});

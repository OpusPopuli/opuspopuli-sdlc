// Version-guard path rules (#55).
import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresBump, distributedChanges } from "./version-guard.ts";

test("a registry change requires a bump (the #45-#47 case)", () => {
  assert.equal(requiresBump("controls/registry.yaml"), true);
  assert.equal(requiresBump("controls/examples/payments.compliance-profile.yaml"), true);
});

test("the docs consumers read require a bump", () => {
  assert.equal(requiresBump("docs/compliance-model.md"), true);
  assert.equal(requiresBump("docs/architecture.md"), true);
});

test("plans and change records do not", () => {
  assert.equal(requiresBump("docs/plans/55-version-guard.md"), false);
  assert.equal(requiresBump("docs/compliance/changes/55-change-record.md"), false);
  assert.equal(requiresBump("docs/compliance/releases/2026-08-24-csa-repin-validation.md"), false);
});

test("the plugin, the Codex skills and the AGENTS.md template require a bump", () => {
  for (const p of ["skills/op-review/SKILL.md", "hooks/data-scan.ts", ".claude-plugin/plugin.json", ".agents/skills/op-verify/SKILL.md", "templates/codex/AGENTS.md"]) {
    assert.equal(requiresBump(p), true, p);
  }
});

test("repo plumbing does not", () => {
  for (const p of [".github/workflows/internal-drift.yml", "package.json", "package-lock.json", ".nvmrc", "LICENSE", ".gitignore"]) {
    assert.equal(requiresBump(p), false, p);
  }
});

test("distributedChanges filters a git diff --name-only listing", () => {
  const listing = "docs/plans/x.md\ncontrols/registry.yaml\n\npackage.json\nskills/op-ci/SKILL.md\n";
  assert.deepEqual(distributedChanges(listing.split("\n")), ["controls/registry.yaml", "skills/op-ci/SKILL.md"]);
});

// Codex skill generation (#60). Synthetic repos live in temp dirs; the real tree is only read.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import {
  generate,
  staleFiles,
  toCodex,
  parseSkill,
  validateName,
  CODEX_DIR,
  CODEX_REWRITES,
  type SkillSource,
} from "./generate-agent-skills.ts";

const src = (over: Partial<SkillSource> = {}): SkillSource => ({
  name: "op-demo",
  description: "Demo skill. Use when testing.",
  argumentHint: "<issue-number>",
  body: "\nPlan issue #$ARGUMENTS, then run `/op-verify` and `/op-validate`.\nSee [registry](../../controls/registry.yaml) and skills/op-verify/SKILL.md.\n",
  ...over,
});

function frontmatter(md: string): Record<string, unknown> {
  return parse(/^---\n([\s\S]*?)\n---\n/.exec(md)![1]);
}

test("frontmatter keeps only name and description (argument-hint is not a Codex field)", () => {
  const fm = frontmatter(toCodex(src(), "9.9.9", []));
  assert.deepEqual(Object.keys(fm).sort(), ["description", "name"]);
  assert.equal(fm.name, "op-demo");
});

test("$ARGUMENTS becomes {input}, defined by an Input line from argument-hint", () => {
  const out = toCodex(src(), "9.9.9", []);
  assert.ok(!out.includes("$ARGUMENTS"));
  assert.ok(out.includes("Plan issue #{input}"));
  assert.match(out, /\*\*Input:\*\* `<issue-number>`/);
  assert.match(out, /ask for it/);
});

test("an optional input says to use the default instead of asking", () => {
  const out = toCodex(src({ argumentHint: "<context> (optional; defaults to the diff)" }), "9.9.9", []);
  assert.match(out, /it is optional/);
  assert.doesNotMatch(out, /ask for it/);
});

test("a skill without $ARGUMENTS gets no Input line", () => {
  assert.doesNotMatch(toCodex(src({ body: "\nJust do it.\n" }), "9.9.9", []), /\*\*Input:\*\*/);
});

test("slash invocations become $-invocations, but paths are left alone", () => {
  const out = toCodex(src(), "9.9.9", []);
  assert.ok(out.includes("`$op-verify`") && out.includes("`$op-validate`"));
  assert.ok(out.includes("skills/op-verify/SKILL.md"));
});

test("relative links are rebased one directory deeper", () => {
  assert.ok(toCodex(src(), "9.9.9", []).includes("](../../../controls/registry.yaml)"));
});

test("the generated header names the source and version", () => {
  assert.match(toCodex(src(), "1.2.3", []), /GENERATED from skills\/op-demo\/SKILL\.md \(opuspopuli-sdlc v1\.2\.3\)/);
});

test("a rewrite that no longer matches its source fails generation", () => {
  assert.throws(
    () => toCodex(src(), "9.9.9", [{ skill: "op-demo", from: "Anthropic", to: "OpenAI" }]),
    /no longer matches/,
  );
});

test("names must match the directory and Codex's naming rule", () => {
  assert.deepEqual(validateName("op-demo", "op-demo"), []);
  assert.ok(validateName("op-demo", "op-other").length > 0);
  assert.ok(validateName("Op_Demo", "Op_Demo").length > 0);
  assert.ok(validateName("a".repeat(65), "a".repeat(65)).length > 0);
});

test("a skill with no frontmatter is rejected", () => {
  assert.throws(() => parseSkill("no frontmatter here", "x.md"), /frontmatter/);
});

// Against the real tree: everything generates, and nothing runtime-specific survives in the Codex copy.
test("every real skill generates, and the Codex copies carry no Claude-only constructs", () => {
  const out = generate();
  assert.ok(out.size >= 18);
  for (const [rel, md] of out) {
    assert.ok(!md.includes("$ARGUMENTS"), `${rel} still has $ARGUMENTS`);
    assert.ok(!/(^|[^A-Za-z0-9_./-])\/op-[a-z]/.test(md), `${rel} still has a /op- invocation`);
    assert.ok(!md.includes("Anthropic"), `${rel} still names Anthropic`);
    const fm = frontmatter(md);
    assert.equal(typeof fm.description, "string");
  }
});

test("every configured rewrite targets a real skill", () => {
  const names = [...generate().keys()].map((k) => k.split("/").at(-2));
  for (const r of CODEX_REWRITES) assert.ok(names.includes(r.skill), r.skill);
});

test("the committed .agents/skills tree is in sync with skills/", () => {
  assert.deepEqual(staleFiles(generate()), []);
});

test("staleFiles reports missing, out-of-date and orphaned Codex skills", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-skills-"));
  try {
    const expected = new Map([
      [join(CODEX_DIR, "op-a", "SKILL.md"), "A"],
      [join(CODEX_DIR, "op-b", "SKILL.md"), "B"],
    ]);
    mkdirSync(join(root, CODEX_DIR, "op-b"), { recursive: true });
    writeFileSync(join(root, CODEX_DIR, "op-b", "SKILL.md"), "stale");
    mkdirSync(join(root, CODEX_DIR, "op-gone"), { recursive: true });
    writeFileSync(join(root, CODEX_DIR, "op-gone", "SKILL.md"), "x");
    const problems = staleFiles(expected, root).join("\n");
    assert.match(problems, /op-a\/SKILL\.md: missing/);
    assert.match(problems, /op-b\/SKILL\.md: out of date/);
    assert.match(problems, /op-gone\/SKILL\.md: no source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

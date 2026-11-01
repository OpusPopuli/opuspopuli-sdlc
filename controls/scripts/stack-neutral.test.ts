// Skills stay stack-neutral (#71): no skill names a package manager or build tool outside a marked
// `<!-- stack-examples -->` block. Commands come from the repo's .sdlc/stack.yaml via hooks/stack.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONTROLS_DIR } from "./registry.ts";

const ROOT = join(CONTROLS_DIR, "..");
const TOOL = /\b(pnpm|npm|yarn|npx|bun|mvn|mvnw|gradle|gradlew)\b/;
// The control footer cites this repo's own tooling (`npm run reconcile`), not the consumer's stack.
const FOOTER = /`npm run reconcile`/;

export function strayToolMentions(markdown: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  markdown.split("\n").forEach((line, i) => {
    if (line.includes("<!-- stack-examples -->")) inBlock = true;
    else if (line.includes("<!-- /stack-examples -->")) inBlock = false;
    else if (!inBlock && TOOL.test(line) && !FOOTER.test(line)) out.push(`${i + 1}: ${line.trim()}`);
  });
  if (inBlock) out.push("unclosed <!-- stack-examples --> block");
  return out;
}

test("no skill names a package manager or build tool outside a stack-examples block", () => {
  for (const dir of readdirSync(join(ROOT, "skills"))) {
    const md = readFileSync(join(ROOT, "skills", dir, "SKILL.md"), "utf8");
    assert.deepEqual(strayToolMentions(md), [], `skills/${dir}/SKILL.md`);
  }
});

test("the guard catches a hardcoded command and allows a marked example", () => {
  assert.equal(strayToolMentions("1. Run: pnpm lint && pnpm test").length, 1);
  assert.equal(strayToolMentions("Run `./gradlew check`").length, 1);
  assert.deepEqual(strayToolMentions("<!-- stack-examples -->\n- pnpm.overrides\n<!-- /stack-examples -->"), []);
  assert.deepEqual(strayToolMentions("`npm run reconcile` fails if this list and the registry disagree"), []);
  assert.deepEqual(strayToolMentions("<!-- stack-examples -->\n- mvn"), ["unclosed <!-- stack-examples --> block"]);
});

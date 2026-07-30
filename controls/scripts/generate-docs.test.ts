import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRegistry } from "./registry.ts";
import { renderControlMapping, spliceGenerated, DOC_PATH } from "./generate-docs.ts";

const MARKED = `intro prose\n<!-- BEGIN generated:control-mapping -->\nOLD\n<!-- END generated:control-mapping -->\ntrailing prose\n`;

test("the committed doc is up to date with the registry (--check would pass)", () => {
  const reg = loadRegistry();
  const doc = readFileSync(DOC_PATH, "utf8");
  assert.equal(spliceGenerated(doc, renderControlMapping(reg)), doc);
});

test("generation is idempotent — generating twice yields identical output", () => {
  const reg = loadRegistry();
  const once = spliceGenerated(MARKED, renderControlMapping(reg));
  const twice = spliceGenerated(once, renderControlMapping(reg));
  assert.equal(once, twice);
});

test("a mutated registry changes the output (--check would fail)", () => {
  const reg = loadRegistry();
  const before = spliceGenerated(MARKED, renderControlMapping(reg));
  reg.controls[0].title = "MUTATED TITLE FOR TEST";
  const after = spliceGenerated(MARKED, renderControlMapping(reg));
  assert.notEqual(before, after);
  assert.ok(after.includes("MUTATED TITLE FOR TEST"));
});

test("splice preserves prose outside the markers", () => {
  const reg = loadRegistry();
  const out = spliceGenerated(MARKED, renderControlMapping(reg));
  assert.ok(out.startsWith("intro prose\n"));
  assert.ok(out.endsWith("trailing prose\n"));
  assert.ok(!out.includes("OLD"));
});

test("missing markers throw rather than corrupting the doc", () => {
  assert.throws(() => spliceGenerated("no markers here", "x"), /markers not found/);
});

test("reversed markers throw", () => {
  const reversed = "<!-- END generated:control-mapping -->\n<!-- BEGIN generated:control-mapping -->";
  assert.throws(() => spliceGenerated(reversed, "x"), /precedes BEGIN/);
});

test("duplicate markers throw", () => {
  const dup = `${MARKED}\n<!-- BEGIN generated:control-mapping -->`;
  assert.throws(() => spliceGenerated(dup, "x"), /duplicate markers/);
});

test("rendered table is deterministically ordered by framework sort then control id", () => {
  const reg = loadRegistry();
  const table = renderControlMapping(reg);
  // HIPAA (sort 1) rows precede the ISO row (sort 5); within GxP, AIQ precedes CSA by id.
  assert.ok(table.indexOf("CTL-HIPAA-001") < table.indexOf("CTL-ISO-001"));
  assert.ok(table.indexOf("CTL-AIQ-001") < table.indexOf("CTL-CSA-001"));
});

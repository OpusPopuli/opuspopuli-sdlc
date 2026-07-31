import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGISTRY_PATH } from "./registry.ts";
import { canonicalize } from "./format-registry.ts";

// The committed registry must already be in canonical serialized form, so a re-pin (#4) or any edit
// produces a minimal diff instead of reformatting churn (#14). If this fails, run
// `npm run registry:format`.
test("controls/registry.yaml is in canonical serialized form", () => {
  const text = readFileSync(REGISTRY_PATH, "utf8");
  assert.equal(text, canonicalize(text), "run `npm run registry:format` to normalize");
});

// Canonicalization is a fixed point — formatting an already-canonical file changes nothing.
test("canonicalize is idempotent", () => {
  const once = canonicalize(readFileSync(REGISTRY_PATH, "utf8"));
  assert.equal(once, canonicalize(once));
});

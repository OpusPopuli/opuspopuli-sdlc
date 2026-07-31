// Rewrites controls/registry.yaml in the canonical serialized form pin.ts uses (#14), so a re-pin
// produces a minimal diff instead of reformatting churn. Comments are preserved (Document API).
// Usage:
//   node --experimental-strip-types controls/scripts/format-registry.ts          # rewrite
//   node --experimental-strip-types controls/scripts/format-registry.ts --check  # verify, exit 1 on diff
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { REGISTRY_PATH, REGISTRY_YAML_OPTIONS } from "./registry.ts";

export function canonicalize(text: string): string {
  return parseDocument(text).toString(REGISTRY_YAML_OPTIONS);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const text = readFileSync(REGISTRY_PATH, "utf8");
  const canonical = canonicalize(text);
  if (process.argv.includes("--check")) {
    if (text !== canonical) {
      console.error("registry.yaml is not in canonical form — run `npm run registry:format`");
      process.exit(1);
    }
    console.log("registry.yaml is canonical");
  } else if (text !== canonical) {
    writeFileSync(REGISTRY_PATH, canonical);
    console.log("reformatted controls/registry.yaml to canonical form");
  } else {
    console.log("registry.yaml already canonical");
  }
}

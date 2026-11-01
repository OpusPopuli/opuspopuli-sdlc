// Validate consuming-repo compliance profiles against the registry and the profile schema.
// Usage:
//   node --experimental-strip-types controls/scripts/validate-profile.ts <profile.yaml>  # one file
//   node --experimental-strip-types controls/scripts/validate-profile.ts                 # all examples
//   node --experimental-strip-types controls/scripts/validate-profile.ts --repo <dir>    # a repo's own profile
//     (.sdlc/compliance-profile.yaml, falling back to the deprecated .claude/ path; #56)
// Exit 0 = valid (warnings allowed); 1 = at least one error. Offline.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv } from "ajv";
import { loadRegistry, CONTROLS_DIR } from "./registry.ts";
import {
  loadProfile,
  validateProfile,
  findProfile,
  EXAMPLE_PROFILES_DIR,
  PROFILE_PATH,
  LEGACY_PROFILE_PATH,
  type ProfileFinding,
} from "./profile.ts";

const PROFILE_SCHEMA_PATH = join(CONTROLS_DIR, "schema", "compliance-profile.schema.json");

function checkOne(path: string): ProfileFinding[] {
  const schema = JSON.parse(readFileSync(PROFILE_SCHEMA_PATH, "utf8"));
  const profile = loadProfile(path);
  const ajv = new Ajv({ allErrors: true, strict: false });
  if (!ajv.validate(schema, profile)) {
    return (ajv.errors ?? []).map((e) => ({
      level: "error" as const,
      message: `schema: ${e.instancePath || "/"} ${e.message}`,
    }));
  }
  return validateProfile(loadRegistry(), profile);
}

function exampleProfiles(): string[] {
  return readdirSync(EXAMPLE_PROFILES_DIR)
    .filter((f) => f.endsWith(".compliance-profile.yaml"))
    .map((f) => join(EXAMPLE_PROFILES_DIR, f));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const arg = process.argv[2];
  let paths: string[];
  if (arg === "--repo") {
    // Resolve the profile the way skills do (#56): canonical .sdlc/, then legacy .claude/.
    const root = process.argv[3] ?? ".";
    const loc = findProfile(root);
    for (const n of loc.notices) console.error(`warning: ${n}`);
    if (loc.path === null) {
      console.log(`no compliance profile in ${root} (looked for ${PROFILE_PATH}, ${LEGACY_PROFILE_PATH})`);
      process.exit(0);
    }
    paths = [loc.path];
  } else {
    paths = arg ? [arg] : exampleProfiles();
  }
  let errorCount = 0;
  for (const path of paths) {
    const findings = checkOne(path);
    const rel = path.replace(`${CONTROLS_DIR}/`, "controls/");
    for (const f of findings) console.error(`${f.level}: ${rel}: ${f.message}`);
    errorCount += findings.filter((f) => f.level === "error").length;
    if (findings.every((f) => f.level !== "error")) console.log(`profile valid: ${rel}`);
  }
  if (errorCount > 0) {
    console.error(`${errorCount} profile error(s)`);
    process.exit(1);
  }
}

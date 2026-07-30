// Offline validator for controls/registry.yaml — schema (ajv) + semantic checks.
// Usage: node --experimental-strip-types controls/scripts/validate.ts [registry.yaml]
// Exit code 0 = valid; 1 = findings (printed one per line).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { Ajv } from "ajv";
import { SCHEMA_PATH, REGISTRY_PATH } from "./registry.ts";

export { SCHEMA_PATH };

export interface Finding {
  level: "error";
  message: string;
}

interface ValidateOptions {
  // Repo root used to resolve implemented_by refs and the intended_use path.
  repoRoot: string;
}

const PINNABLE = new Set(["ecfr", "eurlex", "document"]);

export function validateRegistry(registry: unknown, opts: ValidateOptions): Finding[] {
  const findings: Finding[] = [];
  const err = (message: string) => findings.push({ level: "error", message });

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const valid = ajv.validate(schema, registry);
  if (!valid) {
    for (const e of ajv.errors ?? []) {
      err(`schema: ${e.instancePath || "/"} ${e.message}`);
    }
    // Semantic checks assume the shape is right; stop here if it isn't.
    return findings;
  }

  const reg = registry as {
    preamble: { intended_use: string };
    profiles: { families: string[] };
    frameworks?: Record<string, { label: string; sort: number }>;
    controls: Array<{
      id: string;
      family: string;
      status: string;
      citations: Array<Record<string, unknown>>;
      implemented_by: Array<{ type: string; ref: string }>;
    }>;
  };

  if (!existsSync(join(opts.repoRoot, reg.preamble.intended_use))) {
    err(`preamble: intended_use file not found: ${reg.preamble.intended_use}`);
  }

  const families = new Set(reg.profiles.families);
  const frameworks = reg.frameworks ?? {};
  // Every framework label must key a declared family — no orphan labels.
  for (const key of Object.keys(frameworks)) {
    if (!families.has(key)) {
      err(`frameworks: "${key}" is not a declared family in profiles.families`);
    }
  }
  const seenIds = new Set<string>();

  for (const control of reg.controls) {
    if (seenIds.has(control.id)) err(`${control.id}: duplicate control id`);
    seenIds.add(control.id);

    if (!families.has(control.family)) {
      err(`${control.id}: family "${control.family}" is not declared in profiles.families`);
    }
    // Completeness for the generated compliance-model table (#2): every family a control uses
    // must resolve to a display label, so a new pack (#7-#9) can't add a family that renders blank.
    if (!frameworks[control.family]) {
      err(`${control.id}: family "${control.family}" has no entry in frameworks[] (needed for the generated table)`);
    }

    for (const impl of control.implemented_by) {
      if (impl.type === "skill") {
        const p = join(opts.repoRoot, "skills", impl.ref, "SKILL.md");
        if (!existsSync(p)) err(`${control.id}: skill "${impl.ref}" has no skills/${impl.ref}/SKILL.md`);
      } else if (impl.type === "hook") {
        const p = join(opts.repoRoot, "hooks", `${impl.ref}.md`);
        if (!existsSync(p)) err(`${control.id}: hook "${impl.ref}" has no hooks/${impl.ref}.md`);
      }
      // "architecture" refs are documented posture in docs/compliance-model.md — no file check.
    }

    // The no-vendoring boundary, enforced twice: the schema rejects unknown fields on clause
    // citations; this guards against a schema regression ever re-allowing bulk text.
    for (const c of control.citations) {
      if (c.adapter === "clause") {
        for (const [key, value] of Object.entries(c)) {
          if (typeof value === "string" && value.length > 500) {
            err(`${control.id}: clause citation field "${key}" is ${value.length} chars — looks like vendored text; clause citations are identifiers only`);
          }
        }
      }
    }

    const unpinned = control.citations.filter(
      (c) => PINNABLE.has(c.adapter as string) && !("pinned" in c)
    );
    if (control.status === "active" && unpinned.length > 0) {
      err(`${control.id}: status is "active" but ${unpinned.length} pinnable citation(s) have no pin — status must be "pin-pending"`);
    }
    if (control.status === "pin-pending" && unpinned.length === 0) {
      err(`${control.id}: status is "pin-pending" but every pinnable citation is pinned — status must be "active"`);
    }
  }

  return findings;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const registryPath = process.argv[2] ?? REGISTRY_PATH;
  const registry = parse(readFileSync(registryPath, "utf8"));
  const findings = validateRegistry(registry, { repoRoot: process.cwd() });
  for (const f of findings) console.error(`${f.level}: ${f.message}`);
  const pending = (registry?.controls ?? []).filter((c: { status: string }) => c.status === "pin-pending").length;
  if (findings.length === 0) {
    console.log(`registry valid: ${registry.controls.length} controls${pending ? ` (${pending} pin-pending)` : ""}`);
  } else {
    console.error(`${findings.length} finding(s)`);
    process.exit(1);
  }
}

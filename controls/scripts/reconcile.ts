// Cross-repo reconciliation: the registry vs. the skills/hooks/docs that reference it.
// Distinct from validate.ts (which validates the registry file in isolation) — this scans the
// repo for references back to the registry and fails when they disagree.
// Usage: node --experimental-strip-types controls/scripts/reconcile.ts
// Exit 0 = consistent; 1 = findings (printed one per line). Offline, no secrets.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, CONTROLS_DIR, type Registry } from "./registry.ts";

const REPO_ROOT = join(CONTROLS_DIR, "..");
const CONTROL_ID_RE = /CTL-[A-Z0-9]+-\d{3}/g;
// docs/compliance/** evidence paths a skill might reference, with glob or <placeholder> forms.
const EVIDENCE_REF_RE = /docs\/compliance\/[A-Za-z0-9/_*<>.-]+\.md/g;

export interface Finding {
  file: string;
  message: string;
}

// Normalize a referenced evidence path so <issue>/<version>/<slug> placeholders and the registry's
// `*` glob compare equal — the two express the same artifact location in different notations.
export function normalizeEvidencePath(path: string): string {
  return path.replace(/<[^>]+>/g, "*").replace(/\*+/g, "*");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function referenceFiles(): string[] {
  const roots = ["skills", "hooks"].map((d) => join(REPO_ROOT, d));
  return roots.flatMap((r) => walk(r)).filter((f) => f.endsWith(".md"));
}

export function reconcile(reg: Registry, files: string[]): Finding[] {
  const findings: Finding[] = [];
  const knownIds = new Set(reg.controls.map((c) => c.id));
  const declaredEvidence = new Set(
    reg.controls.flatMap((c) => c.evidence ?? []).map(normalizeEvidencePath)
  );

  for (const file of files) {
    const rel = relative(REPO_ROOT, file);
    const text = readFileSync(file, "utf8");

    // Reverse control-ID check: a cited control ID must exist in the registry.
    for (const id of new Set(text.match(CONTROL_ID_RE) ?? [])) {
      if (!knownIds.has(id)) {
        findings.push({ file: rel, message: `cites unknown control ${id} (not in registry)` });
      }
    }

    // Evidence-path agreement: a docs/compliance/** artifact path a skill names must be declared
    // as evidence by some control.
    for (const path of new Set(text.match(EVIDENCE_REF_RE) ?? [])) {
      if (!declaredEvidence.has(normalizeEvidencePath(path))) {
        findings.push({
          file: rel,
          message: `references evidence path "${path}" that no control declares in evidence[]`,
        });
      }
    }
  }

  return findings;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const findings = reconcile(loadRegistry(), referenceFiles());
  for (const f of findings) console.error(`drift: ${f.file}: ${f.message}`);
  if (findings.length === 0) {
    console.log("registry ↔ skills/hooks/docs consistent");
  } else {
    console.error(`${findings.length} drift finding(s)`);
    process.exit(1);
  }
}

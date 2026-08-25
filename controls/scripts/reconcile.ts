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

// FORWARD check (#48): a skill or hook the registry names in `implemented_by` must cite the control
// back. `reconcile()` above is the REVERSE check — it catches a skill citing a control that doesn't
// exist. Nothing caught the opposite, so the only test of an implementation claim was that
// `skills/<ref>/SKILL.md` EXISTS. The registry could name any skill for any control and stay green,
// and all 19 claims were in exactly that state when this was written: claim recorded in one place,
// artifact in another, nothing comparing them — the same shape as the mislabelled pin in #41, applied
// to implementation rather than citation.
//
// `CTL-P11-001` is requirement-to-code traceability. Its own links have to be traceable.
//
// Separate from reconcile() because it is a whole-repo check: it needs the complete file set to
// conclude a file is absent, whereas reconcile() is meaningful on any subset.
// `root` exists so tests can lay out a synthetic repo in a temp dir. It is NOT a convenience: a
// default-to-REPO_ROOT-only signature forced an early version of the tests to write fixture files
// into the real skills/ tree, which clobbered two of them. Fixtures must never be able to reach the
// working tree.
export function reconcileImplementedBy(reg: Registry, files: string[], root: string = REPO_ROOT): Finding[] {
  const findings: Finding[] = [];
  const byFile = new Map(files.map((f) => [relative(root, f), readFileSync(f, "utf8")]));
  for (const control of reg.controls) {
    for (const impl of control.implemented_by ?? []) {
      const rel =
        impl.type === "skill" ? `skills/${impl.ref}/SKILL.md`
        : impl.type === "hook" ? `hooks/${impl.ref}.md`
        : null;
      if (rel === null) continue; // `architecture` refs are prose posture, with no file to check
      const text = byFile.get(rel);
      if (text === undefined) {
        findings.push({ file: rel, message: `${control.id} names this ${impl.type}, but the file does not exist` });
      } else if (!text.includes(control.id)) {
        findings.push({
          file: rel,
          message: `${control.id} claims this ${impl.type} implements it, but the file never cites ${control.id}`,
        });
      }
    }
  }
  return findings;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const reg = loadRegistry();
  const files = referenceFiles();
  const findings = [...reconcile(reg, files), ...reconcileImplementedBy(reg, files)];
  for (const f of findings) console.error(`drift: ${f.file}: ${f.message}`);
  if (findings.length === 0) {
    console.log("registry ↔ skills/hooks/docs consistent");
  } else {
    console.error(`${findings.length} drift finding(s)`);
    process.exit(1);
  }
}

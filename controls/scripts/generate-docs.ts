// Renders registry-derived sections of docs/compliance-model.md from controls/registry.yaml.
// The control-mapping table is generated; hand-written prose outside the markers is untouched.
// Usage:
//   node --experimental-strip-types controls/scripts/generate-docs.ts          # write
//   node --experimental-strip-types controls/scripts/generate-docs.ts --check  # verify, exit 1 on drift
//
// Deterministic (sorted, no timestamps) so --check is a stable equality test — the internal-drift
// gate (#3) calls --check in CI.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, CONTROLS_DIR, type Registry, type Control } from "./registry.ts";

export const DOC_PATH = join(CONTROLS_DIR, "..", "docs", "compliance-model.md");
const BEGIN = "<!-- BEGIN generated:control-mapping -->";
const END = "<!-- END generated:control-mapping -->";

function escapeCell(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").replace(/\|/g, "\\|").trim();
}

function renderImplementedBy(control: Control): string {
  return control.implemented_by
    .map((impl) => {
      if (impl.type === "skill") return `\`${impl.ref}\``;
      if (impl.type === "hook") return `\`${impl.ref}\` (hook)`;
      return `${impl.ref} (arch)`;
    })
    .join(", ");
}

export function renderControlMapping(reg: Registry): string {
  const fw = reg.frameworks;
  // Group by framework sort order, then control id — fully deterministic.
  const rows = [...reg.controls].sort((a, b) => {
    const sa = fw[a.family]?.sort ?? Number.MAX_SAFE_INTEGER;
    const sb = fw[b.family]?.sort ?? Number.MAX_SAFE_INTEGER;
    return sa - sb || a.id.localeCompare(b.id);
  });
  const lines = [
    "| Control ID | Framework | Control | Implemented by |",
    "|------------|-----------|---------|----------------|",
    ...rows.map(
      (c) =>
        `| \`${c.id}\` | ${escapeCell(fw[c.family]?.label ?? c.family)} | ${escapeCell(c.title)} | ${renderImplementedBy(c)} |`
    ),
  ];
  return lines.join("\n");
}

// Replace the content between the markers, leaving everything else — including the markers
// themselves and all hand-written prose — byte-for-byte intact.
export function spliceGenerated(doc: string, generated: string): string {
  const begin = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  if (begin === -1 || end === -1) {
    throw new Error(`generate-docs: markers not found (need ${BEGIN} … ${END})`);
  }
  if (end < begin) throw new Error("generate-docs: END marker precedes BEGIN marker");
  if (doc.indexOf(BEGIN, begin + 1) !== -1 || doc.indexOf(END, end + 1) !== -1) {
    throw new Error("generate-docs: duplicate markers");
  }
  const before = doc.slice(0, begin + BEGIN.length);
  const after = doc.slice(end);
  return `${before}\n\n${generated}\n\n${after}`;
}

function main(): void {
  const check = process.argv.includes("--check");
  const reg = loadRegistry();
  const doc = readFileSync(DOC_PATH, "utf8");
  const next = spliceGenerated(doc, renderControlMapping(reg));

  if (check) {
    if (next !== doc) {
      console.error("compliance-model.md is out of date with the registry — run `npm run docs:generate`");
      process.exit(1);
    }
    console.log("docs up to date with the registry");
    return;
  }

  if (next !== doc) {
    writeFileSync(DOC_PATH, next);
    console.log("regenerated control-mapping table in docs/compliance-model.md");
  } else {
    console.log("docs already current");
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();

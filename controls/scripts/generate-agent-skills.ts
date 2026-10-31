// Generate Codex skills from the canonical skills/ tree (#60).
//
// skills/<name>/SKILL.md is the single source of truth. This writes .agents/skills/<name>/SKILL.md,
// the repo-level location Codex discovers, translating only what is runtime-specific:
//
//   - `$ARGUMENTS`        Codex has no argument substitution. Becomes `{input}`, defined in an
//                         "Input" line built from the skill's `argument-hint`.
//   - `/op-foo`           Claude slash invocation. Becomes `$op-foo`, Codex's explicit invocation.
//   - `argument-hint`     Not a Codex frontmatter field. Dropped from frontmatter (used for "Input").
//   - relative links      Rebased one directory deeper (.agents/skills/<name>/ vs skills/<name>/).
//   - named rewrites      Prose that names the runtime (data-handling posture, plugin version).
//                         Each MUST match: a rewrite that stops matching fails generation, so the
//                         Codex copy cannot silently keep saying "Anthropic" after the source moves.
//
// The workflow, gates, controls and evidence are not translated: both runtimes follow the same
// contract. Usage:
//   node --experimental-strip-types controls/scripts/generate-agent-skills.ts          # write
//   node --experimental-strip-types controls/scripts/generate-agent-skills.ts --check  # CI: fail if stale
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { CONTROLS_DIR } from "./registry.ts";

export const REPO_ROOT = join(CONTROLS_DIR, "..");
export const SOURCE_DIR = "skills";
export const CODEX_DIR = join(".agents", "skills");

// Codex rejects names outside this shape (lowercase letters, digits, hyphens; <= 64 chars).
export const CODEX_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CODEX_NAME_MAX = 64;

export interface Rewrite {
  skill: string;
  from: string;
  to: string;
}

// Runtime-specific prose, by skill. Exact strings, each required to match at least once.
export const CODEX_REWRITES: Rewrite[] = [
  {
    skill: "op-validate",
    from: '(e.g. "Claude Opus 5,\n     `claude-opus-5`")',
    to: "(as configured for Codex, e.g. the `model` in\n     `~/.codex/config.toml` or the session log)",
  },
  {
    skill: "op-validate",
    from: "development-time AI (Claude Code)",
    to: "development-time AI (Codex)",
  },
  {
    skill: "op-validate",
    from: "source code and diffs are sent to Anthropic's API",
    to: "source code and diffs are sent to OpenAI's API",
  },
  {
    skill: "op-validate",
    from: "tool should assess Anthropic's data-handling terms",
    to: "tool should assess OpenAI's data-handling terms",
  },
  {
    skill: "op-validate",
    from: "the **plugin version** from `.claude-plugin/plugin.json`",
    to: "the **skill version** from this skill's generated header (`opuspopuli-sdlc` vX.Y.Z)",
  },
  {
    skill: "op-review",
    from: "spawn parallel subagents (one per lens)",
    to: "run each lens as a separate pass",
  },
];

export interface SkillSource {
  name: string;
  description: string;
  argumentHint?: string;
  body: string;
}

export function parseSkill(text: string, file: string): SkillSource {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${file}: missing YAML frontmatter`);
  const fm = parse(m[1]) as Record<string, unknown>;
  if (typeof fm.name !== "string" || typeof fm.description !== "string") {
    throw new Error(`${file}: frontmatter needs string name and description`);
  }
  const hint = fm["argument-hint"];
  return {
    name: fm.name,
    description: fm.description,
    ...(typeof hint === "string" && hint.trim() !== "" ? { argumentHint: hint.trim() } : {}),
    body: m[2],
  };
}

export function validateName(name: string, dir: string): string[] {
  const errors: string[] = [];
  if (name !== dir) errors.push(`name "${name}" must match its directory "${dir}"`);
  if (!CODEX_NAME_RE.test(name)) errors.push(`name "${name}" must be lowercase letters, digits and hyphens`);
  if (name.length > CODEX_NAME_MAX) errors.push(`name "${name}" exceeds ${CODEX_NAME_MAX} characters`);
  return errors;
}

// Quote a YAML scalar only when it needs it, so the output stays readable and diff-stable.
function yamlScalar(s: string): string {
  return /^[\w(<][^:#\n]*$/.test(s) && !/\s$/.test(s) ? s : JSON.stringify(s);
}

// A hint like `<issue-number>` would render as an HTML tag; code-format it.
function formatHint(hint: string | undefined): string {
  if (hint === undefined) return "the subject of the request";
  return hint.startsWith("<") ? `\`${hint}\`` : hint;
}

export function toCodex(src: SkillSource, version: string, rewrites: Rewrite[] = CODEX_REWRITES): string {
  let body = src.body;

  for (const r of rewrites.filter((r) => r.skill === src.name)) {
    if (!body.includes(r.from)) {
      throw new Error(`${src.name}: Codex rewrite no longer matches the source: "${r.from}"`);
    }
    body = body.split(r.from).join(r.to);
  }

  const usesArgs = body.includes("$ARGUMENTS");
  body = body.replaceAll("$ARGUMENTS", "{input}");
  // `/op-foo` only where it is an invocation, never inside a path like skills/op-foo/SKILL.md.
  body = body.replace(/(^|[^A-Za-z0-9_./-])\/(op-[a-z0-9-]+)/g, "$1$$$2");
  body = body.replaceAll("](../../", "](../../../");

  const header = [
    "---",
    `name: ${src.name}`,
    `description: ${yamlScalar(src.description)}`,
    "---",
    "",
    `<!-- GENERATED from skills/${src.name}/SKILL.md (opuspopuli-sdlc v${version}) by`,
    "     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->",
    "",
  ];
  if (usesArgs) {
    const optional = src.argumentHint !== undefined && /optional|^\(none/i.test(src.argumentHint);
    header.push(
      `**Input:** ${formatHint(src.argumentHint)}. Codex has no argument substitution: take \`{input}\``,
      optional
        ? "from the user's request; it is optional, so use the default when the request does not give one."
        : "from the user's request, and ask for it if the request does not say.",
      "",
    );
  }
  return header.join("\n") + "\n" + body.replace(/^\n+/, "");
}

export function pluginVersion(root: string = REPO_ROOT): string {
  const manifest = JSON.parse(readFileSync(join(root, ".claude-plugin", "plugin.json"), "utf8"));
  return String(manifest.version);
}

// Build every Codex skill in memory: relative output path → content. Throws on any invalid source.
export function generate(root: string = REPO_ROOT): Map<string, string> {
  const version = pluginVersion(root);
  const out = new Map<string, string>();
  const errors: string[] = [];
  const srcRoot = join(root, SOURCE_DIR);
  const dirs = readdirSync(srcRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const dir of dirs) {
    const file = join(SOURCE_DIR, dir, "SKILL.md");
    if (!existsSync(join(root, file))) continue;
    try {
      const src = parseSkill(readFileSync(join(root, file), "utf8"), file);
      errors.push(...validateName(src.name, dir).map((e) => `${file}: ${e}`));
      out.set(join(CODEX_DIR, dir, "SKILL.md"), toCodex(src, version));
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  // Every rewrite must belong to a skill that exists, or it is dead configuration.
  for (const r of CODEX_REWRITES) {
    if (!dirs.includes(r.skill)) errors.push(`CODEX_REWRITES names unknown skill "${r.skill}"`);
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return out;
}

// Compare the generated set with what is committed: stale, missing, and orphaned files all count.
export function staleFiles(expected: Map<string, string>, root: string = REPO_ROOT): string[] {
  const problems: string[] = [];
  for (const [rel, content] of expected) {
    const abs = join(root, rel);
    if (!existsSync(abs)) problems.push(`${rel}: missing`);
    else if (readFileSync(abs, "utf8") !== content) problems.push(`${rel}: out of date`);
  }
  const codexRoot = join(root, CODEX_DIR);
  if (existsSync(codexRoot)) {
    for (const d of readdirSync(codexRoot, { withFileTypes: true })) {
      const rel = join(CODEX_DIR, d.name, "SKILL.md");
      if (d.isDirectory() && d.name.startsWith("op-") && !expected.has(rel)) {
        problems.push(`${rel}: no source in skills/ (orphan)`);
      }
    }
  }
  return problems;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  let expected: Map<string, string>;
  try {
    expected = generate();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
  if (process.argv.includes("--check")) {
    const problems = staleFiles(expected);
    for (const p of problems) console.error(`drift: ${p}`);
    if (problems.length > 0) {
      console.error(`${problems.length} Codex skill(s) out of sync; run \`npm run skills:generate\``);
      process.exit(1);
    }
    console.log(`Codex skills up to date (${expected.size})`);
  } else {
    for (const [rel, content] of expected) {
      mkdirSync(join(REPO_ROOT, rel, ".."), { recursive: true });
      writeFileSync(join(REPO_ROOT, rel), content);
    }
    console.log(`wrote ${expected.size} Codex skill(s) to ${CODEX_DIR}/`);
  }
}

# Plan of record: ship the lifecycle skills for Codex (#60)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#60](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/60) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-10-31 ("go forth") |
| **Data classification** | None. Markdown and tooling only. |
| **Branch** | `feat/codex-skills-60` (stacked on #58, #56) |

## Codex conventions this relies on

Checked against `codex-cli 0.166.0` (its help text and bundled skill-creator guidance):

- Repo skills are discovered in `.agents/skills/<name>/SKILL.md`.
- Frontmatter needs `name` (lowercase letters, digits and hyphens, at most 64 characters) and `description`.
- Explicit invocation is `$name`. There is no argument substitution.
- `codex debug prompt-input` in a scratch consumer repo listed all 18 generated skills under their
  plain names, from the `.agents/skills/` root.

## Deliberate choices

- **Generate, never hand-maintain.** `skills/` is the only source; `.agents/skills/` is committed output,
  and CI fails if it is stale, missing or orphaned. Two hand-edited copies would drift.
- **Translate only what is runtime-specific.** `$ARGUMENTS` → `{input}` with an "Input" line built
  from `argument-hint` (optional inputs say so, rather than prompting); `/op-foo` → `$op-foo`, but
  never inside a path; relative links rebased.
- **Named prose rewrites must match.** `op-validate`'s AI-qualification record names the vendor and the
  version source. If the source text changes, generation fails instead of shipping a Codex copy that
  says "Anthropic".
- **Commit the generated tree.** Consumers copy it without running Node; reviewers see exactly what ships.
- **No `agents/openai.yaml`.** It is optional, and its UI metadata adds nothing for this workflow yet.
- **Minor bump (0.4.0 → 0.5.0).** Gate spec doc changed; the Codex headers carry the version.

## Subtasks

1. `generate-agent-skills.ts` (generate / `--check`) + 14 tests; `skills:generate`, `skills:check`;
   `skills:check` added to `npm run check`.
2. Generated `.agents/skills/` (18 skills).
3. `templates/codex/AGENTS.md`.
4. README "Using Codex", `architecture.md`, `controls/README.md`, gate spec note.
5. Version bump; change record.

## Risk register (severity × likelihood → mitigation)

1. **Codex copies drift from the source** — high × likely without a gate → `skills:check` in CI;
   test asserts the committed tree is in sync.
2. **A Codex copy misstates the AI data-handling posture** — high × possible → required-match rewrites;
   test asserts no generated skill names Anthropic.
3. **Codex conventions change** — medium × possible → conventions checked against the CLI and recorded
   here; discovery verified with `codex debug prompt-input`.
4. **Behavioural parity untested end to end** — medium × likely → stated in the README and change record;
   first real runs of `op-issue-plan`, `op-data-scan`, `op-verify` on one consuming repo before wider use.
5. **Dependency/licence risk** — low × rare → none added (`@openai/codex` used only for verification,
   not added to the repo).

## Effort

One focused session.

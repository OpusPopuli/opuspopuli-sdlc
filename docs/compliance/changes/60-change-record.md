# Change record: lifecycle skills for Codex, generated from skills/

| Field | Value |
|---|---|
| **Change ID** | `CHG-60` |
| **Title** | `.agents/skills/` generated from `skills/`, with a CI staleness check and an AGENTS.md template |
| **Issue** | [#60](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/60) |
| **Plan** | [`docs/plans/60-codex-skills.md`](../../plans/60-codex-skills.md) |
| **Branch** | `feat/codex-skills-60` (stacked on #58, #56) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-AIQ-001` |

## What changed and why

Codex users get the same 18 lifecycle skills. They are generated from `skills/`, so there is one source
and CI fails when the copies are stale. Only runtime-specific parts are translated: argument
substitution, invocation syntax, frontmatter, link depth, and `op-validate`'s AI-qualification wording.

## Changes

| File | Change |
|---|---|
| `controls/scripts/generate-agent-skills.ts` | Generator with `--check` |
| `controls/scripts/generate-agent-skills.test.ts` | 14 tests |
| `.agents/skills/op-*/SKILL.md` (18) | Generated Codex skills |
| `templates/codex/AGENTS.md` | Consuming-repo AGENTS.md template |
| `package.json` | `skills:generate`, `skills:check`; `check` includes `skills:check` |
| `README.md`, `docs/architecture.md`, `controls/README.md`, `hooks/pre-push-gate.md` | "Using Codex" how-to; layout and scripts |
| `.claude-plugin/plugin.json` | 0.4.0 → 0.5.0 |

## Data classification

**None.** No PHI/PII/CA personal information.

## Verification evidence

- `npm run check`: all gates green; 146/146 tests.
- `codex-cli 0.166.0`: `codex debug prompt-input` in a scratch consumer repo listed all 18 skills from
  `.agents/skills/` under their plain names (`op-issue-plan`, …).
- **Not verified:** a signed-in Codex session running a skill end to end.

## Security evidence

No new dependencies. The generator reads `skills/` and writes `.agents/skills/` under the repo root only.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Consumers that copied `.agents/skills/` keep their copies until they remove them.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass and Codex discovery was observed |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

# Change record: provider-neutral, fail-closed AI review gate

| Field | Value |
|---|---|
| **Change ID** | `CHG-58` |
| **Title** | Gate stages 7–8 run on Claude Code or Codex through a fail-closed reference runner |
| **Issue** | [#58](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/58) |
| **Plan** | [`docs/plans/58-provider-neutral-review-gate.md`](../../plans/58-provider-neutral-review-gate.md) |
| **Branch** | `feat/provider-neutral-review-gate-58` (stacked on #56) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-HIPAA-001`, `CTL-SOD-001`, `CTL-AIQ-001` |

## What changed and why

The AI review stages were Claude-specific and undefined on failure. They now run through a
provider interface, and every outcome other than a completed, parseable, non-blocking review blocks
the push.

## Changes

| File | Change |
|---|---|
| `hooks/review-gate.ts` | New reference runner: providers `claude`, `codex`; lenses `code`, `security`; fail-closed `decide()` |
| `hooks/review-gate.test.ts` | 22 tests |
| `hooks/pre-push-gate.md` | Stages 7–8 provider-neutral; fail-closed table; husky how-to |
| `package.json` | `npm test` includes `hooks/*.test.ts` |
| `README.md`, `docs/architecture.md` | Runner documented |
| `.claude-plugin/plugin.json` | 0.3.0 → 0.4.0 |

## Data classification

**None in this repo.** At runtime the runner sends the consuming repo's diff to the configured hosted
model, which is unchanged exposure from the previous `claude --print` stage.

## Verification evidence

- `npm run check`: all gates green; 132/132 tests.
- End to end with stub `claude`/`codex` binaries in a temp git repo: high finding → blocked; clean →
  passed; prose → blocked; exit 3 → blocked; hang past `--timeout 1` → blocked; CLI missing → blocked.
  Evidence JSON written.
- Codex flags checked against `codex-cli 0.166.0 exec --help`.
- **Not verified:** a live review against a signed-in Claude or Codex account. First real run should
  happen on one consuming repo before rollout.

## Security evidence

No dependencies. Codex runs `--sandbox read-only --ephemeral`; no `--dangerously-*` flag (asserted in
tests). Arguments are passed as an argv array, never through a shell.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Consumers that vendored `review-gate.ts` keep their copy; the spec reverts to `claude --print`.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass and every incomplete review blocks |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

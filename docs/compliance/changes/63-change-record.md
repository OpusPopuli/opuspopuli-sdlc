# Change record: repo-specific review criteria per lens

| Field | Value |
|---|---|
| **Change ID** | `CHG-63` |
| **Title** | `review-gate.ts` adds `.sdlc/review/<lens>.md` to the lens prompt when present |
| **Issue** | [#63](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/63) |
| **Plan/decision** | Repo owner, in-session 2026-10-31, while migrating `opuspopuli` to the runner: keep its existing repo-specific gate criteria |
| **Branch** | `feat/repo-review-criteria-63` |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-HIPAA-001`, `CTL-SOD-001` |

## What changed and why

Migrating a consuming repo's gate to the reference runner would have dropped the checks that repo
already enforced (licence rules, API contracts, its security list). The runner now reads optional
per-lens criteria and inserts them after the built-in checks and before the response format, so they
extend the base checks and cannot weaken them or change the output contract.

## Changes

| File | Change |
|---|---|
| `hooks/review-gate.ts` | `criteriaPath()`; `buildPrompt(…, criteria)`; CLI reads `.sdlc/review/<lens>.md` |
| `hooks/review-gate.test.ts` | +4 tests (ordering, empty criteria, path, passthrough) |
| `hooks/pre-push-gate.md` | Documents the criteria files |
| `.agents/skills/*` | Regenerated for the version stamp |
| `.claude-plugin/plugin.json` | 0.5.0 → 0.5.1 |

## Data classification

**None.**

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | Criteria text tells the model to ignore base checks or answer differently | medium × rare | Criteria sit between the base lens and the response format; the decision is still parsed and fails closed; criteria are committed and reviewed like code |
| 2 | Criteria file missing in a repo that expects it | low × possible | Absence is the no-op default; base checks still run |

## Verification evidence

- `npm run check`: all gates green; 150/150 tests.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Criteria files in consuming repos are then ignored, and the base checks still run.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

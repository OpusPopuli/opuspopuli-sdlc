# Change record: make `implemented_by` claims verifiable

| Field | Value |
|---|---|
| **Change ID** | `CHG-48` |
| **Title** | Forward reconcile check; AI-qualification section in `op-validate`; production gate in `op-hotfix` |
| **Issue** | [#48](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/48) |
| **Related** | [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41), [#43](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/43) — same defect class, on citations rather than implementations |
| **Plan of record** | [`docs/plans/48-forward-reconcile.md`](../../plans/48-forward-reconcile.md) |
| **Branch** | `fix/forward-reconcile-implemented-by-48` |
| **Date** | 2026-08-24 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001` (the control whose own links were untraceable), `CTL-P11-002`, `CTL-AIQ-001`, `CTL-CSA-001` |

## What changed and why

`npm run reconcile` printed `registry ↔ skills/hooks/docs consistent` while **all 19 `implemented_by`
claims were unverifiable from the artifacts they name**. Zero skills or hooks cited the control the
registry said they implemented.

`reconcile()` ran only the reverse check (a skill citing a nonexistent control). The forward direction
was untested, so the whole test of an implementation claim was that `skills/<ref>/SKILL.md` exists.

`CTL-P11-001` is requirement-to-code traceability. Its own links weren't traceable.

## Changes

| File | Change |
|---|---|
| `controls/scripts/reconcile.ts` | `reconcileImplementedBy(reg, files, root?)` — a named skill/hook must cite the control ID; `main()` runs both directions |
| 7 skills + `hooks/pre-push-gate.md` | Control footer naming each control **and its meaning** |
| `skills/op-validate/SKILL.md` | New §8 — the AI-qualification record `CTL-AIQ-001` claims it produces: model + plugin version, gating, data-handling posture, reproducibility. Cites `CTL-CSA-001` |
| `skills/op-hotfix/SKILL.md` | New step 8 — stop and show the diff before committing, with an explicit recorded-deviation emergency path |
| `controls/scripts/reconcile.test.ts` | +7 tests including a regression guard on the committed repo |
| `controls/README.md`, `docs/architecture.md` | Document the bidirectional check and its limits |
| `.claude-plugin/plugin.json` | 0.1.1 → **0.2.0** (distributed content changed) |

## Two substantive gaps closed

1. **`op-validate` now records the model version.** The registry claimed it did; the skill never asked.
   The two validation packs that carry one carry it because a human added it, not because the skill
   directed it. That is now an instruction with a `UNKNOWN`-not-inferred rule.
2. **`op-hotfix` now gates the production change itself**, not only its follow-ups. The emergency path
   is explicit — an override is permitted and *recorded*, surfacing in the next `/op-validate`
   exceptions list. A gate that can't be overridden under incident pressure gets bypassed silently.

Corrected from an earlier assessment: `op-pr-prep` is **not** a gap. It emits a PR description for a
human to paste rather than opening the PR, so it is inherently gated.

## Incident during this change — test fixtures wrote into the working tree

Recorded because it is exactly the failure class this repo keeps writing about.

An early `repoWith()` test helper rooted its fixture repo at the **real** `REPO_ROOT` in order to make
`relative()` produce `skills/...` paths. Running the suite overwrote three committed files
(`op-validate`, `op-review`, `op-trace`) with one-line fixture content.

- **Detected by** a committed-vs-working line-count diff across every changed file, run because two
  tests failed in a way that pointed at file content rather than logic.
- **Contained:** all three restored from git; no commit or push occurred while damaged.
- **Fixed at the root:** `repoWith()` now builds in `mkdtemp`, and `reconcileImplementedBy` takes an
  explicit `root` parameter so a fixture cannot resolve to the working tree. A comment on that
  parameter records why it exists.
- **Verified:** a final line-count diff shows every changed file grew; none shrank.

The lesson mirrors the registry defects: a check that can silently corrupt what it checks is worse
than no check. It is in the plan's risk register (risk 2) rather than omitted.

## Data classification

**None** — repo metadata and markdown only. No PHI/PII/CA-personal-information.

## Verification evidence

- `npm run check` — **all gates green, 89/89 tests** (82 prior + 7 new).
- `npm run reconcile` → `registry ↔ skills/hooks/docs consistent` — now meaning both directions.
- Before the fix, the same command produced **19 findings**, one per unverifiable claim.
- Post-change damage audit: every modified file's working line count ≥ its committed count.

**Regression guard.** `test("the committed repo satisfies the forward check")` walks every
`implemented_by` entry in the real registry against the real files. The state this issue found —
19 claims, 0 cited — cannot return silently.

## Security evidence

No new dependencies. No secrets. No new network egress. `reconcileImplementedBy` only reads files
already passed to it. The `root` parameter narrows filesystem reach rather than widening it. Pre-push
gate: ran on push, passed.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed and
approved by the repo owner; no independent human reviewed the diff. Same posture as `CHG-41`,
`CHG-42`, `CHG-43`. Note this change touched the skills that *implement* `CTL-SOD-001`, which raises
rather than lowers the value of an independent look.

## Rollback plan

Fully reversible. `git revert` restores the prior `reconcile.ts`, the skill/hook footers, and the
manifest version together. Reverting reinstates the one-directional check — no corruption, no state
migration. Consumers on 0.2.0 would need the version rolled back too, or they keep the cached 0.2.0
content.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-24 | Attests the change is complete as described, all gates pass, the fixture incident is disclosed in full, and no file remains damaged |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner), in-session instruction "fix the gaps" | 2026-08-24 | "Approved for merge to `main`" — does **not** attest independent review |

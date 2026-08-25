# Plan of record: make `implemented_by` claims verifiable (#48)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#48](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/48) |
| **Date** | 2026-08-24 |
| **Author** | Claude (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-08-24 ("fix the gaps") |
| **Data classification** | None — repo metadata and markdown only. |
| **Branch** | `fix/forward-reconcile-implemented-by-48` |
| **Related** | #41, #43 (the same defect class, on citations) |

## The defect

`reconcile` reported `registry ↔ skills/hooks/docs consistent` while **all 19 `implemented_by` claims
in the registry were unverifiable from the artifacts they name**. Not one skill or hook cited the
control the registry said it implemented.

The cause is that `reconcile()` only ever ran the **reverse** check — a skill citing a control that
doesn't exist is a finding. There was no forward check, so the entire test of an implementation claim
was that `skills/<ref>/SKILL.md` *exists*. The registry could name any skill for any control and stay
green.

This is the third instance of one pattern:

| Issue | Claim recorded here | Artifact lives here | What compared them |
|---|---|---|---|
| #41 | citation `name`/`note` | the pinned bytes | nothing |
| #43 | (same, for the CCPA pins) | the statute text | nothing |
| **#48** | `implemented_by` | the skill/hook file | **nothing** |

`CTL-P11-001` is requirement-to-code traceability. Its own links weren't traceable.

## Two substantive gaps found while auditing

1. **`op-validate` did not produce the AI-qualification record `CTL-AIQ-001` claims it produces.** The
   registry's note reads *"qualification record (model/plugin version, gating, data-handling posture)
   in the release pack"*. The skill had eight sections, none of them about AI qualification, and no
   instruction anywhere in the plugin to record a model version.
2. **`op-hotfix` had no human gate before the production change itself.** It gated its follow-up issues
   and its data-exposure flag, but steps 6–7 prepared a branch and drafted a commit with no checkpoint
   — on the highest-risk path in the lifecycle.

Checked and **not** a gap: `op-pr-prep` outputs a PR description for a human to paste rather than
opening the PR itself, so it is inherently gated. An earlier assessment of it was wrong and is
corrected here.

## Deliberate choices

- **A separate `reconcileImplementedBy()` rather than folding it into `reconcile()`.** The forward
  check is a whole-repo check: it needs the complete file set to conclude a file is absent, whereas
  `reconcile()` is meaningful on any subset (and its existing tests pass single files). Merging them
  would have silently broken that contract.
- **Cite controls in a footer on each skill/hook, not just to satisfy the check.** The footer names the
  control *and what it means*, so a reader of the skill learns which obligations it serves. Traceability
  that only a linter can read is not traceability.
- **`architecture` refs stay exempt.** They describe posture with no file to check; pretending
  otherwise would add a check that can only be satisfied by inventing a file.
- **`op-hotfix` gets a gate with an explicit emergency path.** A gate that cannot be overridden under
  incident pressure gets bypassed silently, which is worse than one that records the override. The
  deviation is recorded and surfaces in the next `/op-validate` exceptions list.
- **Minor version bump (0.1.1 → 0.2.0).** `skills/` and `hooks/` are distributed content; consumers
  cache by version.

## Subtasks

1. `reconcile.ts` — `reconcileImplementedBy(reg, files, root?)`; `main()` runs both checks.
2. Control footers on 7 skills + 1 hook.
3. `op-validate` — new section 8, the AI-qualification record; cite `CTL-CSA-001`.
4. `op-hotfix` — gate before commit, with the recorded-deviation path; renumber steps.
5. Tests, including a regression guard that the committed repo satisfies the forward check.
6. Version bump; evidence artifacts.

## Risk register (severity × likelihood → mitigation)

1. **A registry implementation claim is unverifiable from the artifact** — **high × confirmed (19/19)**
   → forward check in CI; regression test asserts the committed repo satisfies it.
2. **Test fixtures write into the working tree.** — **high × occurred during this change** → an early
   `repoWith()` helper rooted itself at the real repo and clobbered `op-validate`, `op-review` and
   `op-trace`. Detected by a committed-vs-working line-count diff, restored from git, and the helper
   rewritten to build its repo in `mkdtemp`. `reconcileImplementedBy` takes an explicit `root` so a
   fixture can never resolve to the working tree. This risk is recorded rather than quietly fixed
   because a test that mutates the repo it tests is exactly the failure this repo keeps writing about.
3. **The footer becomes a box-ticking string divorced from what the skill does** — **medium × likely
   over time** → footers state the control's meaning, not just its ID; a reviewer comparing the footer
   to the skill body is the control. The check proves citation, not correctness, and says so.
4. **Consumers keep a cached 0.1.1** — **medium × certain without a bump** → version bumped; the
   existing `plugin-version-guard` enforces it.
5. **`op-hotfix`'s new gate slows incident response** — **medium × possible** → the emergency path is
   explicit and one instruction away; the cost is recording it.
6. **Dependency/licence risk** — **low × rare** → none added.

## Follow-ups

- The forward check proves a skill *mentions* its control. It cannot prove the skill *implements* it.
  A semantic check is not available; the honest compensating control is human review of the footer
  against the body, and that limitation belongs in the docs rather than being glossed.

## Effort

~one focused session.

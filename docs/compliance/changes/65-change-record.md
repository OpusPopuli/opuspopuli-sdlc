# Change record: HITECH controls in the HIPAA family

| Field | Value |
|---|---|
| **Change ID** | `CHG-65` |
| **Title** | `CTL-HIPAA-004/005/006`: breach readiness, encryption safe harbor, business associates; family relabelled "HIPAA / HITECH" |
| **Issue** | [#65](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/65) |
| **Plan/decision** | Repo owner, in-session 2026-10-31: HITECH inside the `hipaa` family rather than a new family; HITRUST not mapped (licence); PCI DSS as a separate change |
| **Branch** | `feat/hitech-controls-65` |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001` |

## What changed and why

HITECH is implemented through 45 CFR Part 164, so a repo that handles PHI is under both, and a separate
family would let a repo declare HIPAA without breach notification. Three SDLC touchpoints were uncovered:

| Control | Obligation | SDLC touchpoint |
|---|---|---|
| `CTL-HIPAA-004` | Breach presumed unless a four-factor assessment shows low probability of compromise; notice within 60 days of discovery; burden of proof (§§164.402, 164.404, 164.414) | `op-hotfix` records a "Breach assessment input" block (discovery date, PHI involved, secured or not, the four factors, who it was handed to) and leaves the determination to a named person |
| `CTL-HIPAA-005` | Encrypted PHI is not "unsecured PHI" (§164.402 + HHS guidance; §164.312 encryption specs) | `op-issue-plan` records how PHI is stored and transmitted; `op-review` blocks an unencrypted new PHI store or transport |
| `CTL-HIPAA-006` | Business associates need a BAA meeting §164.314(a) (§164.308(b)) | `op-issue-plan` names new third-party PHI recipients and their BAA status; `op-review` blocks one with no confirmed BAA |

HITRUST CSF is deliberately not mapped: its licence forbids derivative works from any part of the CSF
without written consent. Recorded in `docs/compliance-model.md`.

## Changes

| File | Change |
|---|---|
| `controls/registry.yaml` | Three controls; `hipaa` label → "HIPAA / HITECH" |
| `skills/op-hotfix`, `op-review`, `op-issue-plan` | HITECH instructions; control footers |
| `controls/scripts/profile.test.ts` | +1 test; CCPA-only profile asserts the new controls stay inert |
| `docs/compliance-model.md` | Regenerated table; HITRUST licensing note |
| `README.md` | Framework list |
| `.agents/skills/*` | Regenerated |
| `.claude-plugin/plugin.json` | 0.5.1 → 0.6.0 |

## Pinning — done

Pinned by the repo owner on 2026-10-31 with `npm run pin -- --all-pending` from an unblocked network
(this sandbox cannot reach eCFR or hhs.gov), committed as `67ad72e` on `chore/pin-hitech-65`:

| Citation | Pin |
|---|---|
| 45 CFR 164.402 (×2), 164.404, 164.414, 164.308 | amendment date 2016-12-30 |
| 45 CFR 164.314 | amendment date 2020-11-24 |
| HHS unsecured-PHI guidance page | sha256 `2110edf1…13cf`, retrieved 2026-10-31 |

`CTL-HIPAA-004/005/006` moved from `pin-pending` to `active`. The section text was read before the
controls were written; `pin.ts` recorded the pins, none were written by hand.

## Data classification

**None.**

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | The skill is read as deciding breach status | high × possible | `op-hotfix` says explicitly it does not decide; it records inputs and a named hand-off, and an unresolved assessment is a `/op-validate` exception |
| 2 | Controls ship unpinned | medium × certain until pinned | `pin-pending` status enforced by `validate`; **closed 2026-10-31** — pinned, status `active` |
| 3 | HHS guidance page drifts or is replaced | medium × possible | document citation with `asserts.title`; the drift watch checks it once pinned |
| 4 | HITRUST omission read as a gap | low × likely | documented with the licence reason and the private-overlay path |

## Verification evidence

- `npm run check`: all gates green; 147/147 tests (`skills:check` caught a stale Codex copy during the
  work, and regeneration fixed it).

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. No consuming-repo state depends on the new controls.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass and the controls were written from the regulation text |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

# Change record: always-on sdlc-core family, version guard scope, QMSR and roadmap decisions

| Field | Value |
|---|---|
| **Change ID** | `CHG-50` (also closes #55, #44, #6) |
| **Title** | `CTL-AIQ-001` always on; version guard watches `controls/` and `docs/`; QMSR stays a citation; roadmap epic closed |
| **Issues** | [#50](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/50), [#55](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/55), [#44](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/44), [#6](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/6) |
| **Plan/decision** | Repo owner, in-session 2026-11-01: do all four in one PR; #50 as option 1 (a non-optional family) |
| **Branch** | `chore/low-hanging-55-50-44-6` |
| **Date** | 2026-11-01 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-AIQ-001` |

## What changed and why

**#50: AI tool qualification no longer depends on declaring GxP.** `CTL-AIQ-001` sat in `gxp-csa`, so
it was inert for every adopter that is not in a GxP context, including `opuspopuli` itself, although
every adopter is AI-assisted by construction. The registry gains `profiles.always_on`, and a new
`sdlc-core` family is active for every repo, profile or not. `CTL-AIQ-001` moves there. This is a
contract change to the resolver's inertness semantics: always-on families are added to the active set
before partitioning, the no-profile default now activates them, and declaring one in a profile warns.
`CTL-AIQ-001`'s text, its architecture reference and both "two AI systems" sections are now
agent-neutral (Claude Code or Codex), since the control now reaches Codex users too.

**#55: the version guard watched the wrong paths.** It required a bump only for `skills/`, `hooks/`
and `.claude-plugin/`, on the premise that consumers never read `controls/` or `docs/` from the
installed cache. They do (the marketplace entry is a full clone), and a stale CSA pin reached a
consumer that way. The rules move into `controls/scripts/version-guard.ts` with tests: everything a
consumer reads requires a bump (`.agents/`, `templates/`, `controls/`, `docs/` too), except
`docs/plans/` and `docs/compliance/`. The workflow comment records the incident.

**#44: no `CTL-QMSR-001`.** The SDLC implements no part of a device QMS; a control would claim
implementation where there is only a reference. Rationale recorded in `docs/compliance-model.md`.

**#6: roadmap epic closed.** Tracked scope shipped; EU packs (#7, #9) formally deferred until an EU
consumer exists. Recorded in the issue.

## Changes

| File | Change |
|---|---|
| `controls/registry.yaml` | `profiles.always_on: [sdlc-core]`; `sdlc-core` family and label; `CTL-AIQ-001` → `sdlc-core`, agent-neutral text and arch ref |
| `controls/schema/registry.schema.json` | `profiles.always_on` |
| `controls/scripts/registry.ts`, `validate.ts`, `profile.ts` | Types; always_on must be declared families; resolver and validator honour it |
| `controls/scripts/profile.test.ts` | Updated expectations; +2 tests (AIQ active for every profile; redundant declaration warns) |
| `controls/scripts/version-guard.ts`, `.test.ts` | New path rules + 6 tests |
| `.github/workflows/plugin-version-guard.yml` | Uses the tested rules; Node set up; incident recorded |
| `docs/compliance-model.md`, `controls/intended-use.md` | Agent-neutral AI section; QMSR rationale; regenerated table |
| `README.md`, `docs/architecture.md`, `controls/README.md` | Always-on family documented |
| `.agents/skills/*` | Regenerated |
| `.claude-plugin/plugin.json` | 0.8.0 → 0.9.0 |

## Data classification

**None.**

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | Consumers relied on `CTL-AIQ-001` being inert | low × rare | It only adds an evidence obligation `op-validate` already produces (section 8); minor version bump signals the contract change |
| 2 | The always-on mechanism becomes a dumping ground | medium × possible | Documented as "controls about using this SDLC at all"; adding a family to `always_on` is a reviewed registry change |
| 3 | Version guard now noisier (docs edits require a bump) | low × likely | Plans and change records excluded; the rest is content consumers actually read |
| 4 | Workflow change untested in CI until it runs | medium × possible | Path rules unit-tested; this PR itself exercises the new workflow |

## Verification evidence

- `npm run check`: all gates green; 200 tests.
- Version guard: a listing equal to yesterday's pin-only change (#69) now requires a bump; plans and change records do not.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Reverting restores `CTL-AIQ-001` to `gxp-csa` and the narrower guard.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-11-01 | Attests all gates pass |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

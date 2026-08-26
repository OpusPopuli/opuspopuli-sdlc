# Change record: configurable drift-check cadence, per source and globally

| Field | Value |
|---|---|
| **Change ID** | `CHG-53` |
| **Title** | Declared per-source polling cadence (`weekly`/`monthly`/`quarterly`), default monthly |
| **Issue** | [#53](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/53) |
| **Plan/decision** | Repo owner, in-session 2026-08-25: named tiers + one cron per tier (over `poll_days` + hash-spread); default `monthly` |
| **Branch** | `feat/configurable-drift-cadence-53` |
| **Date** | 2026-08-25 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-CSA-001` |

## What changed and why

The drift watch polled all 11 pinned sources weekly. Measured against how often those sources actually
change, that is **~570 requests a year to catch 1–2 real events** — and it applied one cadence to a
section frozen since 2016 and to one amended three times in two years.

Observed velocity (eCFR full version history):

| Source | Changes (~10 yrs) | Tier assigned |
|---|---|---|
| 21 CFR part 820 (QMSR) | **5** — 2016, 2020, 2024-10, 2026-02-02, 2026-02-04 | `weekly` |
| 45 CFR §164.502 | 3 — 2016, 2024-04, 2024-06 | `monthly` |
| 45 CFR §164.312 | 1 — 2016-12-30 | `quarterly` |
| 21 CFR §11.10 | 1 — 2016-12-29 | `quarterly` |
| 21 CFR §11.50 | 1 — 2016-12-29 | `quarterly` |
| CPPA final regs PDF | dated final text, fixed bytes | `quarterly` |
| CA statutes ×4, FR docket | legislative/notice-driven | `monthly` (default) |

Resulting split: **1 weekly, 6 monthly, 4 quarterly.**

## Design choice

Named tiers with one cron each, over a `poll_days` integer with hash-spread scheduling. The watcher is
deliberately stateless — it compares, never writes — so per-source cadence needs a scheduling mechanism
that carries no cursor. Named tiers keep the schedule legible in the workflow file and let a reader
determine any source's cadence straight from the registry, instead of inferring it from a hash of the
source key.

## Honesty — this is efficiency, not robustness

Stated in the issue, the registry, `controls/README.md` and the code comments, because it would be easy
to present as a hardening:

- **The staleness window widens.** A `quarterly` source can be stale for up to a quarter. Nothing here
  detects anything *faster*; several sources are now detected *slower*.
- **Frequency was never the binding constraint on the failure this repo actually had.** The CSA
  supersession (#41) survived five months of *weekly* polling because the gap was structural
  (`auto_poll: false`, no assertions), not temporal. Cadence tuning does not substitute for coverage.

## Changes

| File | Change |
|---|---|
| `controls/schema/registry.schema.json` | Top-level `drift.default_cadence`; optional `cadence` on `ecfr`/`document`/`fedreg` citations |
| `controls/scripts/check-upstream.ts` | `CADENCES`, `cadenceOf`, `defaultCadenceOf`, `sourcesForCadence`, `skippedForCadence`, `cadenceArg`; `collect()` takes a scope; run log names the tier and lists what it skipped |
| `controls/registry.yaml` | `drift.default_cadence: monthly`; nine per-citation cadences, each justified inline against measured velocity |
| `.github/workflows/upstream-drift.yml` | One cron per tier; `github.event.schedule` → tier; `workflow_dispatch` cadence input (default `all`) |
| `controls/scripts/check-upstream.test.ts` | +10 tests |
| `controls/README.md`, `docs/architecture.md` | Cadence table, the workflow contract, and the staleness caveat |

## Safe-by-default behaviours

- **No flag = poll everything.** Local `drift:dry-run` and manual dispatch keep today's behaviour, so a
  human never receives a partial answer without asking for one.
- **An unmapped cron falls through to `all`.** Over-polling wastes a request; under-polling misses a
  regulation change. The failure mode is deliberately biased toward the former.
- **A scoped run cannot read like a full run.** The log prints `checked 1 of 11 … [weekly tier]` and
  then names every skipped source with its tier.

## Data classification

**None** — scheduling metadata and public-source polling. No PHI/PII/CA-personal-information.

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | A slower tier hides a real change for up to a quarter | medium × likely | tiers assigned from measured velocity; fastest-moving source is `weekly`; trade documented, not implied |
| 2 | A new tier is added with no cron and is silently never polled | high × possible | test asserts one cron per `CADENCES` entry and that the workflow's cron↔tier map covers both directions |
| 3 | A source falls into no tier, or two tiers | high × possible | test asserts the tiers partition every polled source exactly once |
| 4 | A scoped run is mistaken for a full run when triaging | medium × likely | log states `N of M … [tier]` and enumerates skipped sources |
| 5 | A cadence is set by guess rather than evidence | medium × likely | test fails any `cadence:` line in the registry with no justifying comment |
| 6 | Cadence tuning is mistaken for a robustness improvement | medium × likely | stated as an efficiency trade in four places including the code |

## Verification evidence

- `npm run check` — **all gates green, 105/105 tests** (95 prior + 10 new).
- Live per-tier dry runs against real endpoints:
  - `--cadence=weekly` → `checked 1 of 11 … [weekly tier]: 0 drifted, 0 error(s)`, 10 skipped and listed
  - `--cadence=quarterly` → `checked 4 of 11 … [quarterly tier]: 0 drifted, 0 error(s)`
  - `--cadence=all` → `checked 11 of 11 … [all tiers]: 0 drifted, 0 error(s)`
  - `--cadence=hourly` → rejected: `--cadence must be one of weekly, monthly, quarterly (or "all")`
- Workflow YAML parsed and asserted: three crons, one `cadence` dispatch input, tier-resolution step
  present ahead of the check step.
- `npm run registry:format` → canonical.

## Security evidence

No new dependencies, no new secrets, no new egress destinations — strictly *fewer* requests to the same
public government APIs. The tier-resolution step reads `github.event.schedule` (GitHub-controlled) and
`inputs.cadence` (a `choice` enum, so not free text) into a `case` with an explicit default; both are
consumed via `env:` rather than interpolated into the shell body. Pre-push gate: ran on push, passed.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed and
approved by the repo owner; no independent human review. Same posture as `CHG-41`/`42`/`43`/`48`/`51`.

## Rollback plan

Fully reversible. `git revert` restores the single weekly cron and unscoped polling. The `cadence`
fields are optional and the `--cadence` flag defaults to unscoped, so a partial revert (workflow only)
degrades to polling everything weekly rather than breaking. No state migration.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-25 | Attests cadences were assigned from measured eCFR history, all gates pass, and the staleness trade is disclosed rather than framed as a hardening |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner), in-session — chose named tiers and a monthly default | 2026-08-25 | "Approved for merge to `main`" — does **not** attest independent review |

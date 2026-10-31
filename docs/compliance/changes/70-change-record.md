# Change record: deterministic regulated-data scanner

| Field | Value |
|---|---|
| **Change ID** | `CHG-70` |
| **Title** | `hooks/data-scan.ts`: rule-based PHI, PII and card-data scan for the gate (stage 6b) and `op-data-scan` |
| **Issue** | [#70](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/70) |
| **Plan** | [`docs/plans/70-deterministic-data-scan.md`](../../plans/70-deterministic-data-scan.md) |
| **Branch** | `feat/data-scan-70` |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`; implements `CTL-HIPAA-001`, `CTL-CCPA-001`, `CTL-PCI-001` at push time |

## What changed and why

Regulated-data detection had no deterministic layer. The scanner adds one: card numbers (network prefix,
length, Luhn, test cards excluded), track data and CVV/PIN-block literals, SSNs, Medicare Beneficiary
IDs, real-looking emails in test and seed data, and sensitive fields reaching a log, error, telemetry or
prompt call in Java/Kotlin, TypeScript/JavaScript, Python, Go, C# or a generic fallback. It is scoped by
the compliance profile, honors a reasoned allowlist, masks what it reports, and fails closed.

## Changes

| File | Change |
|---|---|
| `hooks/data-scan.ts` | New scanner (Node ≥ 22.6, no dependencies) |
| `hooks/data-scan.test.ts` | 39 tests |
| `hooks/pre-push-gate.md` | Stage 6b, its rule table, husky line; footer cites `CTL-CCPA-001` |
| `skills/op-data-scan` | Runs the scanner first; reports its findings as deterministic |
| `controls/registry.yaml` | Gate notes on `CTL-HIPAA-001`/`CTL-PCI-001`; `CTL-CCPA-001` gains the gate |
| `README.md`, `docs/architecture.md`, `controls/README.md` | Scanner documented; code layer for profile scoping |
| `docs/compliance-model.md`, `.agents/skills/*` | Regenerated |
| `.claude-plugin/plugin.json` | 0.7.0 → 0.8.0 |

## Data classification

**None in this repo.** The scanner runs locally on a consuming repo and sends nothing anywhere.

## Verification evidence

- `npm run check`: all gates green; 192 tests.
- Real codebase: `opuspopuli` monorepo, 2,084 files, 451,302 lines.
  - Its own profile (CCPA): 0 blocking; 12 non-blocking email reports (realistic Gmail addresses in tests, and one role address).
  - Every data class on: 0 blocking; 26 non-blocking reports, all emails reaching log calls that the repo's `SecureLogger` masks.
  - Tuning driven by that run: submodules no longer abort `--all`; `.gov`/`.mil`, role and placeholder emails excluded (91 → 12); type names (`EmailError`) and doc-comment lines no longer count as sinks. Each has a regression test.
- End to end in a scratch repo: planted `LOGGER.info("visit {}", p.getMrn())` and a PAN → blocked (exit 1), masked in output and evidence; allowlisted with reasons → exit 0; allowlist entry with no reason → exit 1; profile without `families:` → exit 1; bad base ref → exit 1.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Consumers that vendored `data-scan.ts` keep their copy; removing the stage 6b line from the
hook disables it.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass and the real-codebase results above |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

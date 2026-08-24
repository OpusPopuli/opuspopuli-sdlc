# Validation note: CTL-CSA-001 re-pin and pin-accuracy verification

| Field | Value |
|---|---|
| **Date** | 2026-08-24 |
| **Scope** | Control registry — `CTL-CSA-001` citation correctness; upstream drift watch capability |
| **Change record** | [`docs/compliance/changes/41-change-record.md`](../changes/41-change-record.md) |
| **Plan of record** | [`docs/plans/41-csa-supersession-repin.md`](../../plans/41-csa-supersession-repin.md) |
| **Issue** | [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) |
| **Compliance profile** | None declared for this repo — framework-agnostic lifecycle plus the full registry under test |

## Purpose

Record the qualification state of the control registry's authoritative-source pins following the
discovery that `CTL-CSA-001` cited the superseded September 2025 FDA CSA guidance while pinning the
bytes of its February 2026 replacement.

## Pin verification — full registry, 2026-08-24

Every pinnable citation was re-verified against its live authoritative source. This is the audit the
briefing asked for: if one pin was wrong, the others had never been independently re-checked either.

| Control(s) | Source | Adapter | Pinned value | Live value | Verdict |
|---|---|---|---|---|---|
| `CTL-HIPAA-001`, `CTL-HIPAA-003` | 45 CFR 164.312 | ecfr | `2016-12-30` | `2016-12-30` | ✅ current |
| `CTL-HIPAA-002` | 45 CFR 164.502 | ecfr | `2024-06-25` | `2024-06-25` | ✅ current |
| `CTL-SOD-001`, `CTL-P11-001`, `CTL-CSA-001` | 21 CFR 11.10 | ecfr | `2016-12-29` | `2016-12-29` | ✅ **verified** (previously unevidenced) |
| `CTL-P11-002` | 21 CFR 11.50 | ecfr | `2016-12-29` | `2016-12-29` | ✅ **verified** (previously unevidenced) |
| `CTL-CSA-001` | 21 CFR 820 (QMSR) | ecfr | `2026-02-04` | `2026-02-04` | ✅ newly added |
| `CTL-CSA-001` | FDA CSA guidance PDF | document | `11e2e21f…` | `11e2e21f…` | ⚠️ checksum correct; **metadata corrected** |
| `CTL-CSA-001` | FR docket `FDA-2022-D-0795` | fedreg | `2025-18468` / `2025-09-24` | `2025-18468` / `2025-09-24` | ⚠️ current, but **coverage gap recorded** |
| `CTL-CCPA-001`, `CTL-CCPA-004` | Cal. Civ. § 1798.140 | document | `989c984f…` | unchanged | ✅ current |
| `CTL-CCPA-001` | CPPA final regs (2023-03-29) | document | `9bbda518…` | unchanged | ✅ current |
| `CTL-CCPA-002` | Cal. Civ. § 1798.100 | document | `81ae0994…` | unchanged | ✅ current |
| `CTL-CCPA-002` | Cal. Civ. § 1798.120 | document | `c2944f38…` | unchanged | ✅ current |
| `CTL-CCPA-003` | Cal. Civ. § 1798.150 | document | `c8decd72…` | unchanged | ✅ current |
| `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-ISO-001`, `CTL-AIQ-001` | SOC 2 TSC, IEC 62304, ISO 14971, GAMP 5 | clause | identifier only | — | ⚪ not pollable (copyrighted); manual edition check outstanding |

**Result: one defective pin, now corrected. No other stale pin found.**

Two items resolved specifically:

- **The 21 CFR Part 11 amendment date `2016-12-29`**, previously carried without evidence, is
  **verified** against the eCFR Versioner API for both §11.10 and §11.50 — retained, not dropped.
  (§11.1 and §11.100 carry newer dates, `2022-02-01` and `2023-03-02`; neither section is cited here.)
- **21 CFR Part 820 / QMSR** (ISO 13485:2016 incorporated by reference; final rule 89 FR 7496,
  effective 2026-02-02) is now pinned as a citation on `CTL-CSA-001`, giving the regulation the new
  guidance is written against an automated drift signal.

## Qualification of the drift watch itself

The watch was demonstrated to have a capability gap, and the gap was closed and then tested against
live infrastructure rather than only against mocks.

| Capability | Before | After |
|---|---|---|
| Detects a changed source it can fetch | ✅ | ✅ |
| Detects a changed source it **cannot** fetch (`auto_poll: false`) | ❌ silently skipped forever | ✅ ages out via `reverify_days`, files its own issue |
| Detects a pin whose **description** is wrong | ❌ structurally impossible | ✅ `asserts` verified against document text |
| Detects a revision announced only in the document, not on the FR docket | ❌ | ✅ (via the above; the `fedreg` proxy still cannot, and now says so) |
| Remediation path `npm run pin -- <CTL-ID>` actually re-pins | ❌ silent no-op | ✅ `--repin` |

**Negative control (the qualifying test).** With `CTL-CSA-001`'s assertions reverted to the original
September 2025 claim, the shipped code was run against the live FDA PDF:

```
ASSERTION FDA guidance — Computer Software Assurance for Production and Quality Management System Software
  -> the asserted issue date 2025-09-24 is named by this document as the date of a version it
     SUPERSEDES — the pin describes the superseded document, not the one at this URL
```

The check detects the original defect against real infrastructure. An earlier, weaker implementation
(plain date containment) **passed** this negative control — the February 2026 document quotes the
superseded date in its own supersession clause — and was strengthened before merge. Recording the
weaker version's failure is part of the evidence: the negative control is what qualified the check.

## Gate results

| Gate | Command | Result |
|---|---|---|
| Schema + semantic validation | `npm run validate` | ✅ `registry valid: 14 controls` |
| Internal drift (generated docs) | `npm run docs:check` | ✅ `docs up to date with the registry` |
| Registry ↔ skills/hooks reconciliation | `npm run reconcile` | ✅ `consistent` |
| Compliance-profile resolution | `npm run profile:check` | ✅ both example profiles valid |
| Unit tests | `npm test` | ✅ **69/69** (51 prior + 18 new) |
| Canonical serialization | `npm run registry:format` | ✅ `already canonical` |
| Upstream drift (CI scope) | `npm run drift:dry-run` | ✅ `11 pinnable source(s): 0 drifted, 0 error(s)` |
| Upstream drift (incl. manual) | `npm run drift:dry-run -- --include-manual` | ✅ `0 drifted, 0 errors`; assertions verified |

## Honest limitations

Stated plainly, because a validation note that only reports successes is not evidence:

1. **`clause` citations remain unverified by any automation.** GAMP 5, SOC 2 TSC, IEC 62304 and
   ISO 14971 are copyrighted; their text is never fetched or vendored. New-edition checks are manual
   and none has been performed in this pass.
2. **The `fedreg` signal is a proxy with measured incomplete coverage.** It watches docket activity,
   not the guidance document, and demonstrably did not fire for the 2026-02-02 revision.
3. **PDF text extraction is best-effort.** It handles FlateDecode content streams and literal strings;
   image-only pages and exotic font encodings yield nothing. Extraction failure is reported as a
   watcher *error*, never as a passing assertion — but it does mean assertion checking is not
   guaranteed for every future PDF.
4. **Assertion checking only runs where the fetch succeeds.** For host-blocked sources that means a
   human running `--include-manual` from an unblocked network, prompted by `reverify_days`. This is a
   human control with automated prompting, not an automated control.
5. **Only `CTL-CSA-001` carries `asserts` today.** The `CTL-CCPA-*` document pins have verified
   checksums but still-untested descriptions. Backfill is a filed follow-up, not done here.
6. **This change is self-reviewed.** It carries no independent human review signature at time of
   writing; see the change record's separation-of-duties section.

## AI tool qualification note (`CTL-AIQ-001`)

This change was produced with Claude Code (Anthropic Claude, model Opus 5) under human direction, with
human approval gates at scope selection and at merge. No autonomous production change was made. The
diff, the negative control, and every gate result above are reproducible by re-running the commands
shown. Source code and diffs were sent to Anthropic's API in the course of the work, consistent with
the posture recorded in `CTL-AIQ-001` — no claim is made that code stayed within a local boundary.

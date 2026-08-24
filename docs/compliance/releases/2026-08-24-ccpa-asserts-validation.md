# Validation note: CCPA pin assertions

| Field | Value |
|---|---|
| **Date** | 2026-08-24 |
| **Scope** | Control registry — assertion coverage across all `CTL-CCPA-*` document citations |
| **Change record** | [`docs/compliance/changes/43-change-record.md`](../changes/43-change-record.md) |
| **Plan of record** | [`docs/plans/43-ccpa-asserts-backfill.md`](../../plans/43-ccpa-asserts-backfill.md) |
| **Issue** | [#43](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/43) |
| **Supersedes limitation** | Limitation 5 of [`2026-08-24-csa-repin-validation.md`](2026-08-24-csa-repin-validation.md) |

## Purpose

Record that every document citation in the control registry now carries a machine-checkable assertion
of what the pinned bytes claim to be, and that each assertion was verified *and* negative-controlled
against its live source.

## Assertion coverage — full registry, 2026-08-24

| Control(s) | Source | Asserted title | Asserted version | Asserted issued | Live verdict |
|---|---|---|---|---|---|
| `CTL-CSA-001` | FDA CSA guidance PDF | Computer Software Assurance … Quality Management System Software | — | `2026-02-02` | ✅ verified (#41) |
| `CTL-CCPA-001`, `CTL-CCPA-004` | Cal. Civ. § 1798.140 | California Code, CIV 1798.140 | Stats. 2025, Ch. 67, Sec. 27 (AB 1170) | `2026-01-01` | ✅ verified |
| `CTL-CCPA-001` | CPPA final regs PDF | *(body identity only — see limitation)* | — | — | ⚠️ partial, by design |
| `CTL-CCPA-002` | Cal. Civ. § 1798.100 | California Code, CIV 1798.100 | Proposition 24, Sec. 4 | `2020-12-16` | ✅ verified |
| `CTL-CCPA-002` | Cal. Civ. § 1798.120 | California Code, CIV 1798.120 | Stats. 2024, Ch. 940, Sec. 1 (AB 1824) | `2025-01-01` | ✅ verified |
| `CTL-CCPA-003` | Cal. Civ. § 1798.150 | California Code, CIV 1798.150 | Stats. 2024, Ch. 121, Sec. 6 (AB 3286) | `2025-01-01` | ✅ verified |

**Result: 6 of 6 document citations carry assertions; all committed assertions verify against live
sources.** No document citation in the registry now has an untested description.

`ecfr` and `fedreg` citations do not carry `asserts` — their pinned value *is* the assertion (an
amendment date, a document number), compared directly against the source on every run. `clause`
citations are copyrighted, never fetched, and remain manually checked.

## The qualifying test: negative control

Assertions that pass are not evidence on their own — an assertion can pass by being too weak to fail.
Each asserted field of each CCPA citation was perturbed and re-checked against the live source:

```
CTL-CCPA-001 § 1798.140     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-001 CPPA regs      as committed: PASS ✓   perturb title:                caught ✓
CTL-CCPA-002 § 1798.100     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-002 § 1798.120     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-003 § 1798.150     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓

13/13 perturbations caught
```

## Substantive verification finding

**`CTL-CCPA-004`'s subdivision claim was checked, not assumed.** The citation asserts that
§ 1798.140**(ag)** carries the service-provider definition and contract terms. AB 1170 amended
§ 1798.140 effective 2026-01-01, and subdivision renumbering under amendment is exactly the silent-
inaccuracy class #41 was about. Live text confirms `(ag) (1) "Service provider" means a person that
processes personal information…` — the claim holds.

This is recorded because the distinction matters to an auditor: "we checked and it was correct" is
evidence; "it was correct" is an assertion of the same kind that failed in #41.

## Gate results

| Gate | Command | Result |
|---|---|---|
| Schema + semantic validation | `npm run validate` | ✅ `registry valid: 14 controls` |
| Internal drift (generated docs) | `npm run docs:check` | ✅ `docs up to date with the registry` |
| Registry ↔ skills/hooks reconciliation | `npm run reconcile` | ✅ `consistent` |
| Compliance-profile resolution | `npm run profile:check` | ✅ both example profiles valid |
| Unit tests | `npm test` | ✅ **75/75** (69 prior + 6 new) |
| Canonical serialization | `npm run registry:format` | ✅ `already canonical` |
| Upstream drift (incl. manual + assertions) | `npm run drift:dry-run -- --include-manual` | ✅ `11 pinnable source(s): 0 drifted, 0 error(s)` |

## Honest limitations

1. **The CPPA regulations PDF cannot corroborate its own edition.** `extractPdfText` recovers the body
   but not the edition date: "March 29", "Title 11" and "division 6" are all absent from the
   extractable text, which is interleaved with accessibility-report metadata and octal-escaped
   punctuation. Its assertion covers body identity only; the 2023-03-29 edition rests on the
   publisher's dated filename plus the sha256. **This is the weakest pin in the registry** and is
   labelled as such in the citation itself.
2. **Assertion checking is containment-based, not semantic.** It confirms a document says what we claim
   it says; it cannot confirm the claim is legally apt, that we cited the right section for the
   control, or that a cross-reference elsewhere in the text did not coincidentally satisfy a check.
3. **`issued` for § 1798.100 is its *effective* date (2020-12-16), not its operative date
   (2023-01-01).** California distinguishes these; the assertion follows the effective date, which is
   what the enactment line states first. A reader comparing to the operative date will see a
   discrepancy that is intentional.
4. **Assertions verify identity, not currency.** They confirm the bytes are what we say; the checksum
   comparison is what detects change. A statute amended tomorrow fires *both*.
5. **PDF text extraction remains best-effort** for any future `raw` citation; an extraction failure is
   reported as a watcher error rather than a passing assertion, but coverage is not guaranteed.
6. **This change was not independently reviewed.** Author, director and approver are the same party.
   The `CTL-SOD-001` deviation is recorded in the change record rather than waived. The negative-control
   run, not the author's judgment, is what an auditor should re-run.

## AI tool qualification note (`CTL-AIQ-001`)

Produced with Claude Code (Anthropic Claude, model Opus 5) under human direction, with human approval
at scope and merge. No autonomous production change. Every assertion in this pack was derived by
fetching the live source and testing candidate values against it *before* writing them into the
registry — deliberately, because writing a plausible-looking claim from model recall is the exact
failure mode `asserts` exists to catch, and an AI is a well-suited source of plausible-looking claims.
Source code and diffs were sent to Anthropic's API, consistent with `CTL-AIQ-001`.

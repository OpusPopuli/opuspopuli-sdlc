# Change record: backfill pin assertions across the CCPA document citations

| Field | Value |
|---|---|
| **Change ID** | `CHG-43` |
| **Title** | Backfill `asserts` on all `CTL-CCPA-*` document pins; add `asserts.version` for statute provenance |
| **Issue** | [#43](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/43) |
| **Parent** | [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) — introduced `asserts` and the verification machinery |
| **Plan of record** | [`docs/plans/43-ccpa-asserts-backfill.md`](../../plans/43-ccpa-asserts-backfill.md) |
| **Branch** | `chore/backfill-ccpa-asserts-43` |
| **Date** | 2026-08-24 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-P11-002`, `CTL-CCPA-001/002/003/004` (under change), `CTL-AIQ-001` |

## What changed and why

#41 established that a `sha256` proves immutability, not accuracy, and added `asserts` so a pin's
human-written claims become falsifiable — but only for `CTL-CSA-001`. The five `CTL-CCPA-*` document
citations remained in exactly the pre-#41 state: verified checksums, untested descriptions. All five
now carry assertions, each verified against live text before commit.

## Design decision: `asserts.version`

`title` + `issued` fit a guidance document. A statute's identity is its **enactment line**, which every
leginfo section states about itself:

| Citation | Asserted version (live-verified) | Effective |
|---|---|---|
| § 1798.140 | `Amended by Stats. 2025, Ch. 67, Sec. 27. (AB 1170)` | 2026-01-01 |
| § 1798.100 | `Amended November 3, 2020, by initiative Proposition 24, Sec. 4.` | 2020-12-16 |
| § 1798.120 | `Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824)` | 2025-01-01 |
| § 1798.150 | `Amended by Stats. 2024, Ch. 121, Sec. 6. (AB 3286)` | 2025-01-01 |

This is version-specific by construction: it changes whenever the law does, so it cannot pass
vacuously the way a title can. `version` is an **optional, additive** schema field — existing citations
remain valid. Constraining the backfill to the existing two fields would have satisfied the issue
literally while producing weak assertions, which defeats its purpose.

## Verification finding: `CTL-CCPA-004`'s subdivision claim is correct

`CTL-CCPA-004` asserts that § 1798.140**(ag)** carries the service-provider definition and contract
terms. § 1798.140 was amended by AB 1170 effective 2026-01-01, and subdivision renumbering under
amendment is precisely the silent-inaccuracy class #41 was about. Checked against live text:

```
(ag) (1) "Service provider" means a person that processes personal information…
```

**The claim holds.** Recorded because "we checked and it was fine" is evidence; "we assumed and it was
fine" is not.

## Honest limitation: the CPPA regulations PDF

`extractPdfText` recovers ~221k characters of the CPPA final regulations, but the extractable text
**cannot corroborate the edition**:

| Claim the citation makes | Verifiable from PDF text? |
|---|---|
| "text of 2023-03-29" / "March 29" | ❌ absent |
| "Cal. Code Regs. tit. 11 div. 6" / "Title 11" / "division 6" | ❌ absent |
| Body identity (`means the California Consumer Privacy Act of 2018`, `7001. Definitions`) | ✅ present |

The text is interleaved with accessibility-report metadata and octal-escaped punctuation (`\223`/`\224`
for curly quotes) and its table of contents extracts reversed. So this citation asserts **only the
body identity**, and its `note` states plainly that the 2023-03-29 edition rests on the publisher's
dated filename plus the checksum — not on anything the document says about itself. An assertion that
looks verified but is not would be worse than none.

## Changes

| File | Change |
|---|---|
| `controls/schema/registry.schema.json` | Optional `asserts.version` (string) on document citations |
| `controls/scripts/check-upstream.ts` | `PinAssertions.version`; `assertionFailures` checks it by normalized containment |
| `controls/registry.yaml` | `asserts` on all five `CTL-CCPA-*` document citations; expanded notes on the CPPA PDF (limitation) and § 1798.140 (subdivision re-verification) |
| `controls/scripts/check-upstream.test.ts` | +6 tests, including registry-level guards |
| `controls/README.md`, `docs/architecture.md`, `docs/compliance-model.md` | Document `version`; record the "write assertions from the source, never from memory" rule |

## Data classification

**None.** Public California statute pages and a public agency PDF. The sources *define* personal
information; they do not contain any. No PHI, PII, or CA-personal-information is read, written, or
transited. `/op-data-scan` not required.

## Risk register

Carried from the plan of record:

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | An assertion is written that the document does not support (reproducing #41 in new citations) | high × possible | every assertion tested against live text before commit; 13/13 negative controls caught |
| 2 | A weak assertion passes vacuously | medium × possible | statutes assert the enactment line; a test enforces `version` on every leginfo pin |
| 3 | PDF extraction noise causes a false mismatch | medium × likely | CPPA assertion limited to an empirically-confirmed phrase; limitation documented |
| 4 | leginfo template churn breaks `title` assertions | low × possible | `normalization: text` strips markup; asserted strings are statute body, not page chrome |
| 5 | California amends a section, firing checksum drift *and* assertion mismatch | low × likely over time | correct behaviour; findings dedup to separate issues by kind, both pointing at one re-pin |
| 6 | Schema change breaks consumers | low × rare | additive and optional; full gate suite green |

## Verification evidence

- `npm run check` — **all gates green, 75/75 tests** (69 prior + 6 new).
- `npm run validate` → `registry valid: 14 controls`
- `npm run docs:check` → `docs up to date with the registry`
- `npm run reconcile` → `registry ↔ skills/hooks/docs consistent`
- `npm run profile:check` → both example profiles valid
- `npm run registry:format` → `registry.yaml already canonical`
- `npm run drift:dry-run -- --include-manual` → `11 pinnable source(s): 0 drifted, 0 error(s)` — **all
  five committed CCPA assertions verify against live sources.**

**Negative control over the committed registry.** Each asserted field of each CCPA citation was
perturbed and re-checked against the live source:

```
CTL-CCPA-001 § 1798.140     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-001 CPPA regs      as committed: PASS ✓   perturb title:                caught ✓
CTL-CCPA-002 § 1798.100     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-002 § 1798.120     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓
CTL-CCPA-003 § 1798.150     as committed: PASS ✓   perturb title/version/issued: caught ✓✓✓

13/13 perturbations caught
```

Assertions that pass are not evidence on their own — an assertion can pass by being too weak to fail.
The perturbation run is what distinguishes a real check from a vacuous one.

## Security evidence

No new dependencies. No secrets or credentials touched. Network egress unchanged in scope
(leginfo.legislature.ca.gov, cppa.ca.gov — both already polled weekly). No new parsing surface: the
`version` check reuses the existing normalized-containment path. Pre-push gate: ran on push, passed.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed and
approved by the repo owner; no independent human reviewed the diff. Same posture as `CHG-41`. What
partially compensates: every assertion is independently reproducible from the commands above, the
negative-control run is the substantive check rather than the author's judgment, and the change is
fully reversible. Treat these assertions as director-approved, not peer-reviewed.

## Rollback plan

Fully reversible, no state migration. `git revert` the merge commit removes the `version` schema field,
the assertion checks, and the five `asserts` blocks together. The schema field is optional and the
`asserts` blocks are additive, so a partial rollback is also safe — an older registry validates against
the newer schema, and a newer registry validates against the older schema only if the `version` keys are
removed (they sit inside `asserts`, which is `additionalProperties: false`).

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-24 | Attests the change is complete as described, all gates pass, and every assertion was verified and negative-controlled against live sources |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner), in-session instruction | 2026-08-24 | "Approved for merge to `main`" — approval of the change for release. Does **not** attest independent review; the approver is also the change's director. |

> Electronic signatures per `CTL-P11-002`: who, when, and what was attested. The reviewer row is left
> explicitly NOT PERFORMED rather than removed, so the deviation stays visible in the audit trail.

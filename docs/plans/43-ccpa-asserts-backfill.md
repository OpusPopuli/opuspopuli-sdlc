# Plan of record: backfill pin assertions across the CCPA document citations (#43)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#43](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/43) |
| **Date** | 2026-08-24 |
| **Author** | Claude (AI-assisted, human-directed) |
| **Data classification** | None — public California statute pages and a public agency PDF. No PHI/PII/CA-personal-information is read or stored; the sources *define* personal information, they do not contain any. |
| **Branch** | `chore/backfill-ccpa-asserts-43` |
| **Depends on** | #41 (merged) — introduced `asserts` and the verification machinery |

## Why

#41 established that a `sha256` proves immutability, not accuracy: `CTL-CSA-001` pinned correct bytes
under a wrong description for eight weeks of clean drift runs. `asserts: { title, issued }` closed that
gap — but only for the one citation that had already bitten us. The five `CTL-CCPA-*` document
citations are in exactly the pre-#41 state: verified checksums, untested descriptions.

## Research findings (live, 2026-08-24)

**1. The statute pages carry an authoritative provenance line.** Every leginfo section ends with its
enactment history:

| Citation | Provenance line (live) |
|---|---|
| § 1798.140 | `(Amended by Stats. 2025, Ch. 67, Sec. 27. (AB 1170) Effective January 1, 2026.)` |
| § 1798.100 | `(Amended November 3, 2020, by initiative Proposition 24, Sec. 4. Effective December 16, 2020. Operative January 1, 2023…)` |
| § 1798.120 | `(Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824) Effective January 1, 2025.)` |
| § 1798.150 | `(Amended by Stats. 2024, Ch. 121, Sec. 6. (AB 3286) Effective January 1, 2025.)` |

This is a far stronger assertable identity than a title: it pins the exact *legislative version*, and
it is the statute's own words about itself — precisely what `asserts` is for.

**2. `CTL-CCPA-004`'s subdivision claim is correct — verified, not assumed.** The citation asserts
that § 1798.140**(ag)** sets the service-provider definition and contract terms. Live text confirms:
`(ag) (1) "Service provider" means a person that processes personal information…`. Worth stating
because § 1798.140 was amended by AB 1170 effective 2026-01-01, and subdivision renumbering is exactly
the silent-inaccuracy class #41 was about. It did not happen here.

**3. The CPPA regulations PDF is only partially readable, and its edition date is not verifiable.**
`extractPdfText` yields 221k characters, but they are interleaved with accessibility-report metadata
and octal-escaped punctuation (`\223` / `\224` for curly quotes), and the table of contents comes out
reversed. Probing for the claims the registry currently makes:

| Claim in the citation | Verifiable from the PDF text? |
|---|---|
| "text of 2023-03-29" / "March 29" | ❌ **absent** |
| "Cal. Code Regs. tit. 11 div. 6" / "Title 11" | ❌ **absent** |
| Body content (`7001. Definitions`, `means the California Consumer Privacy Act of 2018`) | ✅ present |

So the edition date rests on the publisher's dated filename plus the checksum — not on anything the
document says about itself. That must be recorded rather than papered over with an assertion that
looks verified but isn't.

## Deliberate choices

- **Add an optional `asserts.version` string.** `title` + `issued` fit a guidance document; a statute's
  identity is its enactment line. This is an additive, optional schema field — existing citations stay
  valid — and it makes the CCPA assertions genuinely falsifiable instead of nominally present. Making
  them weak in order to avoid a one-field schema change would defeat the purpose of the issue.
- **Assert only what the document actually says.** Every assertion in this change was tested against
  live text *before* being written into the registry, and each is negative-controlled (a deliberately
  wrong value must fail). The failure mode this whole line of work exists to prevent is a
  confidently-written claim nobody checked.
- **Do not assert the CPPA PDF's edition date.** Its `asserts` carries only what is corroborated; the
  citation `note` states plainly that the 2023-03-29 edition is evidenced by filename + checksum, not
  by the document text. An unverifiable assertion that silently passes is worse than none.
- **No `reverify_days` on these.** Unlike the FDA PDF, all five are `auto_poll: true` and their
  checksums are compared weekly — they already have a live drift signal. Adding an age gate would
  file issues for sources that are in fact being watched.

## Subtasks

1. **Schema** — optional `asserts.version` (string) on document citations.
2. **`check-upstream.ts`** — `assertionFailures` checks `version` by normalized containment; extend the
   mismatch message set. Tests for pass, fail, and the statute-specific shapes.
3. **Registry** — `asserts` on all five CCPA document citations; corrected/expanded notes on the CPPA
   PDF and on § 1798.140.
4. **Verify** — `npm run drift:dry-run -- --include-manual` clean, plus a negative control per citation
   (perturb each assertion, confirm it fails).
5. **Docs + evidence** — `controls/README.md`, `docs/architecture.md`, change record, validation note.

## Risk register (severity × likelihood → mitigation)

1. **An assertion is written that the document does not actually support**, reproducing the #41 defect
   in new citations — **high × possible** → every assertion tested against live text before commit;
   negative control per citation; `--include-manual` run recorded in the evidence.
2. **A weak assertion passes vacuously** (e.g. a string so generic it appears in any version) —
   **medium × possible** → statutes assert the enactment line, which is version-specific by
   construction; the CPPA PDF's limitation is documented rather than hidden.
3. **PDF extraction noise causes a false mismatch** on the CPPA regs — **medium × likely** → assert only
   phrases empirically confirmed to survive extraction and `loosen()` normalization; octal-escape
   artifacts verified not to sit inside the asserted spans.
4. **leginfo HTML template churn breaks `title` assertions** — **low × possible** → `normalization: text`
   already strips markup; the asserted strings are statute body/provenance text, not page chrome.
5. **California amends a section, firing both checksum drift and an assertion mismatch** — **low ×
   likely over time** → that is correct behaviour; the two findings dedup to separate issues by kind
   and both point at the same re-pin.
6. **Schema change breaks existing consumers** — **low × rare** → additive and optional; `validate`,
   `docs:check`, `reconcile`, `profile:check` and the full suite gate it.

## Effort

~half a focused session.

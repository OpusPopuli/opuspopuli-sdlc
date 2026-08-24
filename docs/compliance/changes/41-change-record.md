# Change record: CTL-CSA-001 supersession re-pin + pin-accuracy verification

| Field | Value |
|---|---|
| **Change ID** | `CHG-41` |
| **Title** | Re-pin `CTL-CSA-001` to the 2026-02-02 FDA CSA guidance; add pin-accuracy verification |
| **Issue** | [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) |
| **Prior art** | [#20](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/20) (watcher-broken, closed by [#21](https://github.com/OpusPopuli/opuspopuli-sdlc/pull/21) — incomplete: fixed the fetch, never re-verified the pin) |
| **Plan of record** | [`docs/plans/41-csa-supersession-repin.md`](../../plans/41-csa-supersession-repin.md) |
| **Branch** | `fix/csa-supersession-repin-41` |
| **Date** | 2026-08-24 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001` (change management), `CTL-SOD-001` (separation of duties), `CTL-P11-001` (traceability), `CTL-P11-002` (e-signature), `CTL-CSA-001` (the control under change), `CTL-AIQ-001` (AI tool qualification) |

## What changed and why

`CTL-CSA-001`'s FDA guidance citation was labelled as the *Computer Software Assurance for Production
and Quality **System** Software* guidance issued 2025-09-24. The bytes it pinned were, and had always
been, the *Computer Software Assurance for Production and Quality **Management** System Software*
guidance issued **2026-02-02**, which supersedes it. The citation is corrected, re-pinned from live
sources, and given machine-checkable assertions; the two structural gaps that let the mislabelling
persist are closed.

**The registry was not stale — it was inaccurate from the first pin.** On 2026-07-30 `pin.ts` fetched
the February 2026 document and recorded its true checksum, while the hand-written `name:`/`note:`
described the superseded September 2025 document. A `sha256` proves immutability, not accuracy.

## Evidence establishing the defect

| Check | Result |
|---|---|
| Live fetch `https://www.fda.gov/media/188844/download` | HTTP 200, sha256 `11e2e21f…` — **byte-identical to the committed pin** |
| Text extracted from those bytes | "…Quality **Management** System Software … Document issued on **February 2, 2026**. This document supersedes … issued September 24, 2025." |
| `git log -S 11e2e21f… -- controls/registry.yaml` | one commit, `43873e3` (2026-07-30) — the checksum never changed |
| FR docket `FDA-2022-D-0795` (live API) | newest document still `2025-18468` / `2025-09-24` — no notice for the Feb 2026 revision |
| Weekly watcher runs since 2026-07-31 | 5 scheduled runs, all "0 drifted, 0 errors" — accurately, and uselessly |

## Root cause

1. **`auto_poll: false` had no clock.** PR #21 disabled polling of the FDA PDF (fda.gov 404s
   datacenter IPs — a real constraint) with no expiry, so the source was not merely unpolled but
   invisible.
2. **The `fedreg` proxy cannot signal this revision.** PR #21 substituted docket polling for the
   artifact checksum without validating that the docket tracks guidance revisions. It does not.
3. **Underneath both:** nothing ever tested a pin's human-written claims against the bytes it pins.

A third defect was found while implementing the fix: **`pin.ts` skipped any citation that already had
a `pinned:` block**, so the `npm run pin -- <CTL-ID>` re-pin step the watcher's own issue body
prescribes was a silent no-op. Even a correctly-detected drift could not have been remediated as
documented.

## Changes

| File | Change |
|---|---|
| `controls/registry.yaml` | `CTL-CSA-001`: corrected citation `name`/`note`; added `asserts: {title, issued: 2026-02-02}` and `reverify_days: 90`; added 21 CFR 820 (QMSR) ecfr citation; `fedreg` note now records its verified partial coverage. All pin blocks machine-produced. |
| `controls/schema/registry.schema.json` | Optional `asserts` (`title`, `issued`) and `reverify_days` on document citations. `additionalProperties: false` preserved; no text field added, so the no-vendoring boundary is untouched. |
| `controls/scripts/check-upstream.ts` | `daysBetween`/`pinOverdue`/`staleManualFindings` (staleness); `assertionFailures`/`supersededIssueDates`/`issuedDateVariants` (accuracy); `collectManual` + `--include-manual`; kind-aware issue titles/bodies; `retrying()` now maps over its input's keys instead of a hand-written literal. |
| `controls/scripts/pin.ts` | `extractPdfText`/`fetchDocumentText`; `--repin` flag (requires an explicit control ID). |
| `controls/scripts/check-upstream.test.ts` | +18 tests. |
| `docs/compliance-model.md` | CSA prose corrected to the Feb 2026 revision + QMSR anchor; new "What drift detection cannot do" section. |
| `controls/README.md` | Documents `asserts`, `reverify_days`, `--repin`, `--include-manual`, and the honest limits of the watch. |

## Data classification

**None.** Public regulatory documents (fda.gov, ecfr.gov, federalregister.gov) and public APIs only.
No PHI, PII, or CA-personal-information is read, written, or transited. `/op-data-scan` not required;
no regulated data appears in code, tests, fixtures, or logs.

## Risk register

Carried from the plan of record. The two `confirmed` entries are this issue's own root cause:

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | A pin's label is wrong at pin time; every later check confirms the error | high × **confirmed** | `asserts: {title, issued}` verified against extracted document text |
| 2 | A source excluded from polling stays invisible forever | high × **confirmed** | `reverify_days` age gate files its own issue; test enforces the field on every `auto_poll:false` citation |
| 3 | A proxy signal substituted for a direct one without validation | high × **occurred (PR #21)** | `fedreg` note records measured coverage; proxy supplements, never replaces |
| 4 | Symptom fix closes an issue over an unverified pin | medium × **occurred (#20/#21)** | deferred to a follow-up (block-close semantics) — see below |
| 5 | `reverify_days` fires noisily once a pin ages out | medium × likely | deterministic per-source-per-kind title; one open issue until a human re-pins |
| 6 | PDF text extraction is brittle | medium × possible | best-effort; extraction failure is reported as a watcher **error**, never a silent pass |
| 7 | eCFR Part 820 pin churns as QMSR corrections land | low × possible | that is drift working as designed |
| 8 | Dependency/licence risk | low × rare | no new dependencies; `node:zlib` only |

## Verification evidence

- `npm run check` (validate → docs:check → reconcile → profile:check → test) — **all green, 69/69
  tests** (51 prior + 18 new).
- `npm run validate` → `registry valid: 14 controls`
- `npm run docs:check` → `docs up to date with the registry` (internal-drift gate green)
- `npm run reconcile` → `registry ↔ skills/hooks/docs consistent`
- `npm run profile:check` → both example profiles valid
- `npm run registry:format` → `registry.yaml already canonical`
- `npm run drift:dry-run` → `checked 11 pinnable source(s): 0 drifted, 0 error(s)`
- `npm run drift:dry-run -- --include-manual` → 11 sources + manual FDA PDF, **0 drifted, 0 errors** —
  the corrected assertions verify against the live document.

**Behavioral verification (negative control).** Tests passing is not evidence the fix would have
caught the original bug. So the real machinery was run against the real PDF with `CTL-CSA-001`'s
assertions reverted to the original September 2025 claim:

```
ASSERTION FDA guidance — Computer Software Assurance for Production and Quality Management System Software
  -> the asserted issue date 2025-09-24 is named by this document as the date of a version it
     SUPERSEDES — the pin describes the superseded document, not the one at this URL
```

The fix detects the exact defect it was written for, against live infrastructure. Note this required
strengthening the check mid-implementation: plain date containment **passed**, because the February
2026 document quotes "September 24, 2025" verbatim in its own supersession clause. Reading that clause
as a *negative* signal is what makes the check work.

Observed during the negative control: fda.gov intermittently fails the fetch (~1 in 3 from a
residential IP). `main()` wraps all fetchers in `retrying()`, so the shipped path tolerates it; the
ad-hoc proof script did not, which is why the flake was visible at all.

## Security evidence

No new dependencies (`node:zlib` is built in). No secrets, credentials, or tokens touched. Network
egress is unchanged in scope: the same three public government hosts, plus `--include-manual` which is
opt-in and never runs in CI. `extractPdfText` inflates untrusted bytes — bounded by `inflateSync` and
wrapped in try/catch per stream, with failures skipped rather than thrown; output is filtered to
printable ASCII before matching, so malformed PDFs degrade to "could not verify" rather than crashing
or producing phantom matches. Pre-push gate: to run on push.

## Separation of duties

⚠️ **Self-review — countersignature required.** Authored by Claude Code under human direction; no
independent human reviewer has yet reviewed the diff. Per `CTL-SOD-001` this record cannot be
considered complete until a human other than the change's director countersigns below. The PR is the
review vehicle.

## Rollback plan

Fully reversible, no state migration. `git revert` the merge commit restores the previous
`registry.yaml`, schema, scripts, and docs together. Rolling back reinstates the mislabelled
`CTL-CSA-001` citation and removes the staleness/assertion checks — it does not corrupt anything, and
the drift watch returns to its prior (blind) behaviour. Partial rollback of the registry alone is also
safe: the new schema fields are optional, so an older registry validates against the new schema.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-24 | Attests the change is complete as described, all gates pass, and the evidence above was produced by the commands shown |
| Independent reviewer | **UNSIGNED — required** | — | Attests the diff was independently reviewed and the re-pin is correct |
| Approver | **UNSIGNED — required** | — | "Approved for merge to `main`" |

> Electronic signatures per `CTL-P11-002`: who, when, and what was attested. Unsigned rows are
> deliberately left blank — no approval is fabricated. This record is not evidence of approval until
> a human signs it.

## Follow-ups filed

- [#42](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/42) — block-close semantics for
  watcher-broken issues (risk 4): a fetch error on a previously-`200` source must mark affected pins
  unverified and prevent closure until re-verified. Disabling a poll must not count as resolution.
- [#43](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/43) — backfill `asserts` across the
  remaining `CTL-CCPA-*` document citations, which are in the same untested-description state
  `CTL-CSA-001` was in.
- [#44](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/44) — evaluate `CTL-QMSR-001` as a
  first-class control for the amended 21 CFR Part 820.

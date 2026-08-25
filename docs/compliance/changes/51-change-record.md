# Change record: eCFR drift fires on any disagreement, not only a newer source

| Field | Value |
|---|---|
| **Change ID** | `CHG-51` |
| **Title** | `ecfrDrifted` compares for inequality; pin-ahead gets its own diagnosis |
| **Issue** | [#51](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/51) |
| **Related** | [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) (the failure mode this prevents) |
| **Branch** | `fix/ecfr-drift-direction-51` |
| **Date** | 2026-08-25 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-P11-002`, `CTL-CSA-001` |

## What changed and why

`ecfrDrifted` was `liveDate > pinnedDate` — drift only when the source moved *forward*. A pin **ahead**
of the source compared clean forever. `documentDrifted` and `fedregDrifted` have always compared for
inequality; `ecfr` was the only comparator with a directional blind spot.

It now flags any disagreement, and `ecfrDriftDirection()` distinguishes the two cases because they need
opposite instructions:

| Direction | Meaning | Instruction |
|---|---|---|
| `source-newer` | the regulation was amended | triage the change, then re-pin |
| `pin-ahead` | the pin disagrees in a direction eCFR **cannot produce** | do **not** re-pin to match — find out why |

## How it was found — and what did *not* change

A report claimed the four Part 11 pins (`2016-12-29` on §11.10 ×3, §11.50 ×1) were wrong and should
become `2021-12-03` / `2023-03-02`.

**The report was incorrect and its recommendation was rejected.** Verified live against the eCFR
Versioner API — the same primitive that produced the pins:

| Section | eCFR content versions | Cited here? |
|---|---|---|
| §11.10 | `2016-12-29` (one version only) | ✅ ×3 |
| §11.50 | `2016-12-29` (one version only) | ✅ ×1 |
| §11.1 | `2016-12-29`, `2021-12-03`, `2022-02-01` | ❌ |
| §11.100 | `2016-12-29`, `2023-03-02` | ❌ |

The FR actions cited in the report (86 FR 68830, 88 FR 13018) amended **§11.1 and §11.100** — sections
this registry does not cite. The report conflated the part-level authority line with per-section
amendment dates. Its own corroborating quote — *"Subpart B: No changes found after 1/03/2017"* —
confirms the pins, since §11.10 and §11.50 **are** Subpart B.

**No amendment date was changed by this PR.**

## The near-miss that is the actual finding

Had the recommendation been applied, §11.10 would read `2021-12-03` while eCFR serves `2016-12-29`.
Under the old comparator, `live > pinned` → `2016-12-29 > 2021-12-03` → **false**. No drift. The
watcher would have reported green over a knowingly wrong pin indefinitely — the exact #41 failure mode,
newly created by a change intended to prevent it.

The dates were fine. The comparator was not.

## Changes

| File | Change |
|---|---|
| `controls/scripts/check-upstream.ts` | `ecfrDriftDirection()`; `ecfrDrifted` compares for inequality; `driftIssueBody` gives pin-ahead its own heading, diagnosis and instruction |
| `controls/scripts/check-upstream.test.ts` | Existing directional test inverted with rationale; +6 tests |
| `controls/README.md` | Amendment dates are per **section**, not per part; pin-ahead is drift |

## Data classification

**None** — comparison logic and issue text. No PHI/PII/CA-personal-information.

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | A wrong pin ahead of the source passes green forever | high × **demonstrated near-miss** | inequality comparison; regression test encoding the exact near-miss |
| 2 | A future edit blanket-replaces Part 11 dates across sections | high × **attempted once** | test asserts the committed pins are exactly `11.10=2016-12-29`, `11.50=2016-12-29`; README states per-section semantics |
| 3 | Stricter comparison introduces false positives | medium × possible | `drift:dry-run` against all 11 live sources → **0 drifted, 0 errors** |
| 4 | A pin-ahead issue is "resolved" by re-pinning to match, hiding the real cause | medium × likely | the issue body explicitly forbids it and names the likely cause (wrong section) |
| 5 | eCFR recodification legitimately moves a date backwards | low × rare | fires as pin-ahead; a human reviews — correct behaviour, not a false positive |

## Verification evidence

- `npm run check` — **all gates green, 95/95 tests** (89 prior + 6 new).
- `npm run drift:dry-run` → `checked 11 pinnable source(s): 0 drifted, 0 error(s)` — no false
  positives from the stricter comparator.
- Live eCFR queried per section for all ten sections of 21 CFR part 11; the repo's own
  `ecfrLatestAmendment()` returns `11.10 → 2016-12-29`, `11.50 → 2016-12-29`, `11.1 → 2022-02-01`,
  `11.100 → 2023-03-02`.

**Regression test** encodes the near-miss directly:
`assert.equal(ecfrDrifted("2021-12-03", "2016-12-29"), true)` — false before this change.

## Security evidence

No new dependencies, no new network egress, no secrets. Pure comparison logic plus issue text
assembled from registry metadata. Pre-push gate: ran on push, passed.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed and
approved by the repo owner; no independent human review. Same posture as `CHG-41`/`42`/`43`/`48`.

Worth recording: the report that triggered this came from an independent context and was **wrong on
its central claim**. Independent review caught a real defect anyway — via the near-miss, not the
finding. That is an argument for more independent review, not less, and also a caution that an
independent reviewer's conclusion still has to be checked against the source.

## Rollback plan

Fully reversible. `git revert` restores `liveDate > pinnedDate` and the prior issue body. No state
migration; no registry values were changed, so nothing to unwind in the pins themselves.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-25 | Attests the comparator change is complete, the Part 11 dates were verified against eCFR and deliberately left unchanged, and all gates pass |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner), in-session instruction "file that and fix the drift direction check" | 2026-08-25 | "Approved for merge to `main`" — does **not** attest independent review |

# Change record: watcher-broken issues name the pins they leave unverified

| Field | Value |
|---|---|
| **Change ID** | `CHG-42` |
| **Title** | Watcher-broken issues must name affected controls and state that restoring the fetch does not resolve them |
| **Issue** | [#42](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/42) |
| **Prior art** | [#20](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/20) (the issue this defect produced), [#21](https://github.com/OpusPopuli/opuspopuli-sdlc/pull/21) (the incomplete fix it enabled), [#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) (root cause) |
| **Plan of record** | [`docs/plans/42-watcher-broken-names-pins.md`](../../plans/42-watcher-broken-names-pins.md) |
| **Branch** | `fix/watcher-broken-names-pins-42` |
| **Date** | 2026-08-24 |
| **Author** | Claude Code (Anthropic Claude, Opus 5) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-P11-002`, `CTL-CSA-001` (the control the defect obscured), `CTL-AIQ-001` |

## What changed and why

`watcherBrokenIssue()` rendered its body from error labels alone and never named the **controls** whose
pins the failed fetch left unverified. Issue #20 therefore reported *"this URL returned 404"* and never
mentioned `CTL-CSA-001`.

That omission is the causal link in the #20 → #21 failure. Whoever fixed the fetch had no pointer to
the pin underneath; #21 substituted a docket proxy, restored the signal, closed #20, and left a
mislabelled pin in place for eight more weeks of green runs.

The generalizable form: **a fetch failure is a statement about our evidence, not just about the
network.** When a previously-verified source cannot be checked, the pins it backs revert to unverified,
and the issue must say which ones and what clears them.

## Changes

| File | Change |
|---|---|
| `controls/scripts/check-upstream.ts` | `unverifiedPins(reg, errors)` maps errored source keys to controls, citations, pinned values and last-verified dates; `watcherBrokenIssue(errors, reg?)` renders them as a table with explicit closure criteria; `selectNewIssues` threads the registry through |
| `controls/scripts/check-upstream.test.ts` | +7 tests, including a regression test reconstructing #20's exact scenario |
| `controls/README.md`, `docs/architecture.md` | What a watcher-broken issue now contains and what clears it |

## What the issue now says (rendered from #20's exact inputs)

> ## Pins now UNVERIFIED
>
> | Control | Citation | Pinned value | Last verified |
> |---|---|---|---|
> | `CTL-CSA-001` | FDA guidance — Computer Software Assurance … | `11e2e21f5eb2…` | 2026-08-24 |
>
> ## What does NOT resolve this
>
> **Restoring the fetch does not resolve this issue, and neither does silencing it.** Turning a
> source's poll off (`auto_poll: false`) or substituting a proxy signal changes what is watched; it
> does not tell you whether the pin above is correct.

## Scope honesty

**This does not enforce anything.** GitHub cannot be made to refuse a close, and claiming otherwise
would be the same overclaiming this repo keeps correcting. The change makes the right action obvious
and the wrong one visibly wrong; the compensating control that actually re-raises a neglected pin is
`reverify_days` from #41. The issue title in #42 says "block-close"; the delivered behaviour is
"name, explain, and instruct" plus the existing clock. That gap is deliberate and stated here rather
than quietly closed over — which is, precisely, the failure mode this change exists to prevent.

## Data classification

**None.** Renders GitHub issue text from registry metadata. No new network sources; no PHI/PII/CA-
personal-information.

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | A fetch failure silently downgrades evidence and nobody notices | high × **confirmed (#20)** | issue body names every unverified pin and its closure criteria |
| 2 | The fix is mistaken for enforcement it does not provide | medium × likely | stated in the plan, the issue body, the docs, and above |
| 3 | A long error list makes the issue unreadable | low × possible | one sorted table, one row per affected citation; errors are rare |
| 4 | Registry lookup throws while rendering an error issue | medium × rare | rendering is total — missing pins render "never pinned"; covered by a test |
| 5 | Dependency/licence risk | low × rare | no new dependencies |

## Verification evidence

- `npm run check` — **all gates green, 82/82 tests** (75 prior + 7 new).
- `npm run validate` → `registry valid: 14 controls`
- `npm run docs:check` → `docs up to date with the registry`
- `npm run reconcile` → `registry ↔ skills/hooks/docs consistent`
- `npm run profile:check` → both example profiles valid
- `npm run drift:dry-run` → `11 pinnable source(s): 0 drifted, 0 error(s)`

**Behavioral verification.** The body was rendered from #20's exact inputs (FDA source key, HTTP 404)
against the live registry and read end to end — it names `CTL-CSA-001`, its pinned value and its
last-verified date, and states the non-resolutions. A unit test pins that behaviour so the regression
cannot silently return.

**Negative/total-function control.** An unmappable source key renders the "no pinned citation could be
mapped" fallback; a citation with no `pinned` block renders `never pinned` / `never` rather than
throwing. The watcher must always be able to report its own failure, including when the registry is
itself malformed.

## Security evidence

No new dependencies, no new network egress, no secrets. Issue bodies are assembled from registry
metadata and error strings already present in the run log; no source content is interpolated, so a
hostile upstream document cannot inject issue markup. Pre-push gate: ran on push, passed.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed and
approved by the repo owner; no independent human reviewed the diff. Same posture as `CHG-41` and
`CHG-43`. Compensating factors: gates and the rendered-body check are independently reproducible, and
the change is fully reversible.

## Rollback plan

Fully reversible, no state migration. `git revert` the merge commit restores the prior issue body. The
`reg` parameter is optional on both changed functions, so a partial revert also degrades cleanly to the
old behaviour rather than breaking callers.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude, Opus 5), directed by the repo owner | 2026-08-24 | Attests the change is complete as described, all gates pass, and the rendered body was verified against #20's inputs |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner), in-session instruction | 2026-08-24 | "Approved for merge to `main`" — does **not** attest independent review |

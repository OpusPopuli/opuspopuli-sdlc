# Plan of record: watcher-broken issues must name the pins they leave unverified (#42)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#42](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/42) |
| **Date** | 2026-08-24 |
| **Author** | Claude (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-08-24 |
| **Data classification** | None — renders GitHub issue text from registry metadata. No network sources read beyond those already polled. |
| **Branch** | `fix/watcher-broken-names-pins-42` |
| **Prior art** | #20 (the issue this defect produced), #21 (the incomplete fix it enabled), #41 (root-cause analysis) |

## The defect, precisely

`watcherBrokenIssue()` builds its body from error labels only:

```ts
...errors.map((e) => `- **${e.label}** (\`${e.key}\`): ${e.message}`)
```

It never names the **controls** whose pins the failed fetch left unverified. Issue #20 therefore said
*"this URL returned 404"* and **never mentioned `CTL-CSA-001` at all**.

This is not a cosmetic omission. It is the causal link in the #20 → #21 failure:

1. The watcher could not verify the FDA CSA guidance pin. It said so — vaguely.
2. Nobody reading #20 had a pointer to the pin underneath, or to the control depending on it.
3. #21 restored the signal (by substituting a docket proxy) and closed #20. The pin was never
   re-verified. It was, at that moment, mislabelled — and stayed so for eight more weeks.

The generalizable form: **a fetch failure is a statement about our evidence, not just about the
network.** When a previously-verified source cannot be checked, the pins it backs revert to unverified,
and the issue must say which ones and what clears them.

## Deliberate choices

- **Name affected controls, citations, pinned values and last-verified dates** in the watcher-broken
  body — everything a reader needs to know what is now in doubt, without opening the registry.
- **State explicitly that restoring the fetch does not resolve the issue.** This is the sentence that
  would have changed #21's outcome. Closing requires re-verification (`--include-manual`) and, if the
  source moved, a re-pin.
- **Do not attempt to enforce closure in code.** GitHub cannot be made to refuse a close, and pretending
  otherwise would be the same overclaiming this repo keeps correcting. The control is the issue body
  plus the `reverify_days` clock from #41, which re-files if a pin genuinely goes stale. Honest scope:
  this makes the right action obvious and the wrong one visibly wrong; it does not make the wrong one
  impossible.
- **Keep the deduped single "watcher broken" issue.** One issue listing every unverifiable source is
  more actionable than one per source, and its title stays stable for dedup.

## Subtasks

1. **`check-upstream.ts`** — `unverifiedPins(reg, errors)` maps errored source keys to the controls,
   citations and pinned values they back; `watcherBrokenIssue(errors, reg)` renders them as a table
   with explicit closure criteria. Pure and unit-tested.
2. **Tests** — affected-control mapping, the "restoring the fetch does not resolve this" language, an
   errored source shared by multiple controls, an errored source with no pin, and a regression test
   reconstructing #20's exact scenario (a 404 on the FDA source must name `CTL-CSA-001`).
3. **Docs** — `controls/README.md` and `docs/architecture.md`: what a watcher-broken issue now contains
   and what clears it.
4. **Evidence** — change record + validation note.

## Risk register (severity × likelihood → mitigation)

1. **A fetch failure silently downgrades evidence and nobody notices** — **high × confirmed (#20)** →
   the issue body now names every pin left unverified and states what clears it.
2. **The fix is mistaken for enforcement it does not provide** — **medium × likely** → the plan, the
   issue body, and the docs all say plainly that GitHub closure is not blocked in code; the compensating
   control is `reverify_days`.
3. **A long error list makes the issue unreadable** — **low × possible** → one table, one row per
   affected citation, sorted; errors are rare and usually singular.
4. **Registry lookup throws on a malformed citation while rendering an error issue** — **medium × rare**
   → rendering is pure and total: missing pins render as "never pinned" rather than throwing, so the
   watcher can always report its own failure. Covered by a test.
5. **No new dependencies / licence risk** — **low × rare** → none added.

## Effort

~half a focused session.

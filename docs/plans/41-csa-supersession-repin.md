# Plan of record: CTL-CSA-001 supersession re-pin + pin-accuracy verification (#41)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#41](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/41) |
| **Date** | 2026-08-24 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-08-24 (staleness gate + `asserts` block; Part 820 as an ecfr citation on `CTL-CSA-001`, not a new control) |
| **Data classification** | None — public regulatory documents and public APIs only. No PHI/PII/CA-personal-information touched. |
| **Branch** | `fix/csa-supersession-repin-41` |
| **Prior art** | #20 (watcher-broken, closed), #21 (incomplete fix), #4 (the watcher itself) |

**Constraint (plan-of-record #1):** single-language TypeScript, Node ≥ 22.6 native type-stripping,
no build step, deps limited to `ajv` (MIT) + `yaml` (ISC). No new dependency.

## The defect, precisely

`CTL-CSA-001`'s `document` citation carries sha256
`11e2e21f5eb226b56a578da44e732965a2318e9b983422c6a58e51bc7b2e223a`, pinned 2026-07-30. Those bytes
are the **February 2, 2026** guidance — *Computer Software Assurance for Production and Quality
**Management** System Software* — which states on its cover that it supersedes the September 24, 2025
guidance. The citation's `name:` and `note:` describe the superseded September 2025 document.

The checksum was never wrong. The claim attached to it was wrong from the first pin.

**Verification performed:**

| Check | Result |
|---|---|
| `curl` live PDF → sha256 | `11e2e21f…` — byte-identical to the committed pin |
| Text extracted from those bytes | "Document issued on February 2, 2026. This document supersedes … issued September 24, 2025." |
| `git log -S <sha256> -- controls/registry.yaml` | single commit `43873e3` (2026-07-30) — checksum never changed |
| FR docket `FDA-2022-D-0795` (live API) | newest still `2025-18468` / `2025-09-24` |

## Root cause

Two independent blind spots, neither of which is what #20 reported:

1. **`auto_poll: false` never ages out.** PR #21 disabled re-fetching of the FDA PDF because fda.gov's
   CDN 404s datacenter IPs. That was a defensible CI workaround, but it made the source *permanently*
   invisible: the watcher lists it under "manual re-verification" every week and nothing ever forces
   the manual re-verification to happen.
2. **The `fedreg` proxy does not track this document.** PR #21 substituted a Federal Register docket
   poll as the automated signal. FDA issued the February 2026 revision without a new FR notice on
   docket `FDA-2022-D-0795`, so the proxy is structurally incapable of firing for it. The substitution
   was never validated against a known revision.

Underneath both: **nothing in the registry ever checks that a pin's human-readable claims match the
bytes it pins.** A `sha256` is an immutability proof, not an accuracy proof. If the label is wrong at
pin time, every subsequent clean drift check confirms the wrongness.

This is the lesson worth carrying: *drift detection tells you a source changed; it never tells you
that you described the source correctly in the first place.* Pin-time assertions close that gap.

## Deliberate choices (approved)

- **Do not hand-write the pin block.** `controls/README.md` forbids it. The corrected `name`/`note`/
  `asserts` are human-authored fields; the `pinned:` block is refreshed by `npm run pin -- CTL-CSA-001`.
- **`asserts: {title, issued}` on document citations.** Records the document's *self-declared*
  identity next to its checksum, so the claim is falsifiable rather than decorative. Optional field —
  existing citations remain valid without it.
- **`reverify_days` age gate.** An `auto_poll: false` source whose `pinned.retrieved` exceeds the
  threshold becomes a normal drift finding. A source excluded from automated polling must still be
  on a clock.
- **Part 820 as an ecfr citation on `CTL-CSA-001`, not a new control.** The QMSR is the regulation the
  new guidance anchors to; a citation gives it automated drift coverage without inventing a control
  whose `implemented_by`/`evidence` mapping has not been designed. A dedicated `CTL-QMSR-001` is
  deferred, not rejected — see follow-ups.
- **Keep the `fedreg` citation, but label its limitation.** It is a real (if partial) signal for
  docket activity. Its note must stop implying it is sufficient coverage.

## Subtasks

1. **Schema** (`controls/schema/registry.schema.json`) — add optional `asserts` (`title`, `issued`)
   and `reverify_days` (positive integer) to the `document` citation variant. `additionalProperties:
   false` is preserved; no text field is introduced, so the no-vendoring boundary is untouched.
2. **Watcher** (`controls/scripts/check-upstream.ts`) — two pure, unit-testable additions:
   - `staleManualSources(reg, today)` → manual sources past `reverify_days`, emitted as drift
     findings with a distinct body explaining that a *human* must re-verify and re-pin.
   - `assertionMismatch(citation, extractedText)` → for re-verified sources, compare `asserts.title`
     and `asserts.issued` against the fetched document. Runs where the fetch succeeds; a mismatch is
     a drift finding, not a silent pass.
3. **Registry** (`controls/registry.yaml`) — correct `CTL-CSA-001`'s `name`/`note`, add `asserts` +
   `reverify_days: 90`, add the 21 CFR 820 ecfr citation, amend the `fedreg` note to state that the
   docket did not receive a notice for the Feb 2026 revision. Then `npm run pin -- CTL-CSA-001`.
4. **Docs** — rewrite the false "finalized 2025-09-24 … current articulation" prose in
   `docs/compliance-model.md`; document `asserts`/`reverify_days` in `controls/README.md`;
   `npm run docs:generate`.
5. **Gates** — `npm run validate`, `docs:check`, `reconcile`, `profile:check`, `test`,
   `drift:dry-run` all green.
6. **Evidence** — change record (`docs/compliance/changes/41-change-record.md`) and a validation note.

## Risk register (severity × likelihood → mitigation)

1. **A pin's label is wrong at pin time and every later check confirms the error** — **high ×
   confirmed (this issue)** → `asserts: {title, issued}` makes the claim falsifiable; re-verification
   compares it against the fetched document rather than trusting the author.
2. **A source excluded from automated polling stays invisible forever** — **high × confirmed (this
   issue)** → `reverify_days` age gate turns `auto_poll: false` from "never checked" into "checked on
   a human clock, and it files an issue when the clock runs out".
3. **A proxy signal is substituted for a direct one without being validated** — **high × occurred
   (PR #21)** → the `fedreg` note now records exactly what it does and does not cover; the age gate
   means the direct artifact signal is no longer *replaced* by the proxy, only supplemented.
4. **Fixing the symptom closes the issue over an unverified pin** — **medium × occurred (#20/#21)** →
   watcher-broken bodies will point at the affected pins; a fetch error on a previously-`200` source
   is not resolved by disabling the poll. Captured as a follow-up (below) rather than coded here.
5. **`reverify_days` fires noisily every week once a pin ages out** — **medium × likely** → dedup by
   deterministic title already gives one open issue per source; the issue stays open until a human
   re-pins, which is the intended behaviour.
6. **Text extraction from PDFs is brittle** (subset fonts, image-only covers) — **medium × possible**
   → assertion checking is best-effort and only applies where text is extractable; an extraction
   failure is reported as a watcher error, never as a silent pass.
7. **eCFR Part 820 pin churns** as QMSR-related corrections land — **low × possible** → that is drift
   working as designed; a human reviews it.
8. **No new dependencies / licence risk** — **low × rare** → none added.

## Follow-ups (deliberately out of scope)

- **Block-close semantics for watcher-broken issues** (risk 4): a 404 on a previously-`200` source
  should mark the affected pins unverified and require re-verification before the issue can close.
  That is workflow/label policy plus watcher state, and deserves its own plan.
- **`CTL-QMSR-001`** as a first-class control for the amended Part 820, with its own
  `implemented_by`/`evidence` mapping.
- **Backfill `asserts` across all existing document citations** (`CTL-CCPA-*`) so every pinned claim
  is falsifiable, not just the one that bit us.

## Effort

~1 focused session.

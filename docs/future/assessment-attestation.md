# Design note (parked): AI-assisted control assessment & attestation

> **Status: parked thesis, not on the backlog.** This is deliberately deferred — captured so the
> thinking isn't lost, not scheduled. Nothing here is committed to. When/if it's picked up, it
> becomes real issues and a plan-of-record like anything else.

## What this is

The plugin today does the **authoring / evidence** side: controls pinned to primary law, drift
enforcement, and audit evidence emitted as a byproduct of an AI-gated (Claude Code) lifecycle. The
idea captured here is the **other side** — *assessment / attestation*: continuously evaluating
whether a system's accumulated evidence actually **satisfies** its controls, and producing a
reviewable, machine-checkable result. Think of it as the counterpart to the OSCAL/GRC "assessment
results" world, but run inside the repo's own CI.

A plausible runtime: **GitHub Actions using GitHub's own AI (GitHub Models)** as the assessment
engine — so the assessment runs where the code already lives, on the platform's model. (That would
be a *third* AI system in the taxonomy — see "AI qualification" below.)

## The full vision: both sides of one coin

This is not a bolt-on feature; it's the second half of a single operating model:

- **Upstream** — good engineering practices, AI-authored, evidence emitted as a byproduct. *(Built.)*
- **Downstream** — QA automation, a **different** AI assessing/attesting the evidence. *(This note.)*

The human role is **symmetric on both ends and confined to high-value judgment**: gate approval
upstream, attestation downstream — and **zero heavyweight paper-pushing in between**. That symmetry
is CSA applied end-to-end: spend human effort on critical thinking, not ceremony — on the *whole*
value chain, not just the dev half.

Two properties make this more than a slogan:

- **The two-AI split is load-bearing.** One AI authors, a *different* AI assesses. The separation is
  what provides **independence** — the answer to the "fox guarding the henhouse" objection below. An
  assessment from the same model that wrote the evidence isn't credible; a separate assessor's is.
- **It maps to how a regulated org is actually staffed.** A CRO (or any GxP shop) runs *both* an
  engineering population and a QA/validation population, and today pays humans to push paper on both
  ends — engineers writing validation docs, QA re-checking them by hand before every audit. The
  proposition "free your QA staff from the paper-pushing and point them at the judgment calls" is
  aimed squarely at what leadership of that world is measured on. It reframes the work from "a dev
  tool" to "a rethink of the eng + QA operating model."

## Why assessment is the weak link (authoring wasn't)

Authoring is comparatively safe: the AI helps **produce** artifacts with a human at every gate, and
the artifacts are largely objective (a change record exists or it doesn't). Assessment is different
in kind — the AI makes an **evaluative claim with regulatory weight**: "this evidence *satisfies*
this control." That's a judgment a QA lead would otherwise own, and a confidently-wrong one is
dangerous. "The AI says we're compliant" is the exact sentence that makes a serious compliance
professional recoil. The design problem is not "can the AI assess" — it's "how is its assessment
made **defensible** to professional skepticism."

## Objections a CRO / QA reviewer will raise

1. **Attestation is a human accountability act** — a signature means a *named person* takes
   responsibility. An AI cannot be accountable; an AI "attestation" is a category error.
2. **Non-determinism** — an LLM that answers differently on reruns isn't a defensible basis for a
   regulated judgment.
3. **Fox guarding the henhouse** — if the same AI writes the evidence and grades it, there is no
   independence.
4. **Black-box verdict** — "why did it conclude satisfied?" needs a traceable rationale.
5. **Automation bias** — humans rubber-stamping AI verdicts defeats the control entirely.

## Design principles that neutralize them

1. **AI proposes; a human attests. The AI never signs.** The load-bearing move. The AI produces an
   *assessment finding* (a proposal); a named human reviews and attests or rejects. The signature —
   the regulatory act — is always human. The AI is a reviewer's assistant preparing a pack for the
   QA lead, not the reviewer of record. → neutralizes #1.
2. **Shrink the AI's trust surface — deterministic checks do the deterministic work.** Most
   "assessment" is mechanical (does the signed change record exist; does the RTM trace
   requirement→code→test; is the pin current; did coverage clear the floor) and should be **code**:
   reproducible, 100% reliable, no AI. Reserve the AI for the irreducibly judgmental slice (does this
   risk assessment actually address the hazard; does this test meaningfully exercise the
   requirement). → neutralizes #2 for the bulk of the work.
3. **Evidence-anchored findings — falsifiable in seconds.** Every AI finding must cite the *specific*
   artifacts it judged and quote the control text; a finding with no citation is invalid by
   construction. The human **verifies the AI's citations** rather than re-judging from scratch. →
   neutralizes #4 and makes review fast enough to actually happen.
4. **Independence + adversarial posture.** The assessor runs as a *separate pass* from the authoring
   AI, with an inverted stance — "find why this control is **not** satisfied." Where it judges, run
   multiple independent lenses and require agreement; **disagreement itself flags the finding for a
   human.** → neutralizes #3 and blunts confidently-wrong single-shot verdicts.
5. **Qualify the assessor and measure it against ground truth — the credibility killer-move.** Build
   a labeled set (controls + evidence a human expert has judged satisfied/not) and report the
   assessor's agreement, specifically its **false-pass rate**. Tune deliberately toward
   **over-flagging**: the dangerous error is a false "satisfied" (a missed gap); a false "needs
   review" only costs a human a look. "Here's its false-negative rate on N known cases, and it's
   biased to flag" is a sentence a compliance professional can work with. The assessor itself becomes
   a qualified tool (`CTL-AIQ-002`), validated by the same SDLC discipline it serves.

## Concrete artifact

An **assessment finding record** per control:

- control ID + quoted requirement
- deterministic-check results
- the AI's judgment, rationale, **cited evidence**, confidence, and panel-agreement
- status: `deterministic-pass` / `proposed-satisfied` / `proposed-gap` / `needs-human`
- an empty **human attestation slot**: who / when / decision

It mirrors `op-change-record`'s signed structure. Candidate skill/action name: **`op-assess`**, whose
output feeds `op-validate`. The human signs the record; the AI never does.

## The honest ceiling (guardrail, one level deeper)

The truthful framing is **assessment-*assisted*, not auto-attested**: it does not replace the QA
assessment; it keeps the system *continuously pre-assessed* so gaps surface early, the human
assessment is faster, and nothing rots between audits. The human and the real audit remain the
authority — the same "audit-ready, not compliant" discipline applied to assessment.

**Residual risk (do not paper over): automation bias.** Even with all of the above, humans will be
tempted to rubber-stamp. Mitigations are structural — make the human's job "verify the citations,"
not "re-judge"; spot-audit a sample of the AI's passes; track attester override rate as a health
metric — but it never goes to zero. Raise it first in any pitch; a sharp CRO will raise it anyway.

## Where it lives (revised)

Initial instinct was a separate repo; on reflection it likely belongs **here**, at least to start:

- The assessor's whole job is to evaluate evidence against **this** registry — co-location means no
  version-skew and direct reuse of `loadRegistry`, the profile resolver, and the schema. The registry
  is the interface; keep producer and consumer over one interface.
- The repo already holds multiple AI systems cleanly (`CTL-AIQ-001` + `CTL-HIPAA-002`) and both a
  developer-invoked runtime (skills) and a CI-invoked one (drift workflows). A CI-invoked assessment
  action on a third AI is not a new category for this repo.
- The whole selling point is the closed loop (author → assess → attest, one clone); splitting it
  across repos fragments exactly what's novel.

**When to split later:** if the assessment side grows its own release cadence or contributor
community and independent evolution starts to hurt co-location. That's a "when mature" trigger, not
a day-one one.

## On OSCAL (punted, with the reason)

OSCAL is the obvious machine-readable target for assessment results, but its real adoption is
concentrated in **US federal cyber / FedRAMP**, and it is **minimal in life sciences / GxP**, which
runs on CSV/CSA, GAMP, and Part 11. So emitting OSCAL future-proofs toward the cyber/SOC 2 audience,
not the pharma/CRO/GxP one. Deferred until the target audience is decided; it's a format question,
not a design one.

## Novelty (why this is worth doing)

Machine-readable control catalogs exist (OSCAL); infrastructure compliance-as-code platforms exist
(Wiz et al.). Neither is this: OSCAL is a schema, not a runtime that watches the law; the platforms
assess *infrastructure*, not the *development process*, and don't reconcile against primary legal
text. AI-driven *control assessment* run in CI on the platform's own model is essentially unadopted
today — no proven playbook, which means defining the pattern rather than adopting one. Scope note:
target **assessment of controls & evidence** (fits here); leave **runtime/infrastructure posture**
(the Wiz core) out — it's app-adjacent and a commoditized fight.

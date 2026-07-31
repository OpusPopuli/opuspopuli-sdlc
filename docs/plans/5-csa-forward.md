# Plan of record: CSA-forward + AI-honesty docs pass + technical docs (#5)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#5](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/5) |
| **Date** | 2026-07-31 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-31 (conservative "assess Anthropic's terms" framing) |
| **Data classification** | None — documentation and registry prose; no PHI/PII/regulated data. |
| **Branch** | `docs/5-csa-forward` |
| **Depends on** | #1 (merged) |

## Three threads

**1. Correct the AI conflation (honesty fix).** Two AI systems, separated everywhere:
- **SDLC development-time AI = Claude Code (Anthropic Claude).** Sends code/diffs to Anthropic's
  API. Honest qualification: hosted, human-gated phases, versioned skills, audit trail — NOT
  self-hosted, NOT "nothing leaves the boundary." Regulated orgs qualifying the tool should assess
  Anthropic's data-handling terms (no-training-on-inputs, zero-retention options).
- **Consuming app's runtime AI = the app's choice.** Opus Populi runs self-hosted Ollama + a private
  prompt-service to keep *runtime PHI* in-boundary — the app's architecture, a control the app
  satisfies; the SDLC reviews/evidences it.

**2. CSA-forward reframe (original #5).** Explicit CSA-vs-legacy-CSV framing (risk-proportionate,
evidence-as-byproduct, no VMP/scripted-IQOQPQ ceremony), anchored to the pinned FDA CSA guidance
(finalized 2025-09-24). Two-tier source/licensing policy. Drift model (#3 internal, #4
upstream→triage). `op-validate` sections in IQ/OQ/PQ-legible terms — no new required documents.

**3. New technical doc for cloners** — `docs/architecture.md`.

## Subtasks

1. **Registry AI-honesty fix** — rewrite `CTL-AIQ-001` (Claude Code, honest data-handling; replace
   `self-hosted-models`/`private-prompt-service` arch refs) and reframe `CTL-HIPAA-002` as the
   consuming app's runtime residency (self-hosted inference as Opus Populi's implementation, verified
   by op-review/op-validate). Regenerate docs; `registry:format`; full gate green.
2. **`controls/intended-use.md`** — rewrite the "AI tooling qualification" section (Claude Code);
   expand per #5.
3. **`docs/compliance-model.md` prose** — CSA-vs-CSV section (pinned FDA guidance), two-tier
   source/licensing policy, drift model; replace "data-residency advantage" with the honest
   two-AI-systems framing. Generated table stays generated; honesty guardrail verbatim.
4. **Skills + README** — `op-validate` IQ/OQ/PQ labels + fix its self-hosted note; fix
   `op-data-scan`'s self-hosted note (attribute to the consuming app); fix `README.md` data-residency
   line.
5. **`docs/architecture.md`** (new) — registry model + adapters + pinning, the two drift gates, the
   profile/inertness model, the TypeScript/Node toolchain and npm scripts, and how to adopt it.
   Linked from README.
6. **Full `npm run check`** green; **Samir email revision** (scratchpad, not committed).

## Risk register (severity × likelihood → mitigation)

1. Replacing the old overclaim with a new inaccuracy about Anthropic's terms — **medium × possible**
   → conservative "assess their terms (no-training/ZDR)" phrasing.
2. Registry arch-ref rename breaks a gate — **low × possible** → arch refs aren't file-checked;
   `npm run check` confirms.
3. Generated-doc / serialization drift — **low × rare** → `docs:generate` + `registry:format` + gate.
4. Scope creep — **medium × possible** → scope guard: conflation fix + CSA reframe + one architecture
   doc. No new skills, no new controls, no VMP ceremony.
5. Honesty-guardrail regression — **low × rare** → guardrail kept verbatim; PR net-strengthens
   honesty.

## Effort

~1.5–2 focused sessions.

# Audit-ready SDLC — compliance model

This plugin encodes an AI-assisted software development lifecycle where **each phase is a versioned,
human-gated skill**, and the skills emit audit evidence as a byproduct of normal work.

The premise: **compliance frameworks don't ask for different engineering — they ask for provable evidence
that disciplined engineering happened.** Plan-first development, independent review, enforced gates, and
traceability are just good practice. Once those are encoded as skills that *record what they did*, the
evidence an auditor wants falls out of the pipeline instead of being reconstructed under duress.

> **Honesty guardrail.** Everything here is *audit-ready scaffolding and evidence generation* that
> **supports** the controls below. It does **not** make an organization HIPAA / SOC 2 / Part 11 compliant
> on its own — that requires policies, training, risk assessments, vendor BAAs, and an actual audit. Never
> describe a release as "compliant" on the strength of these artifacts; describe it as "audit-ready."

## The lifecycle as skills

| Phase | Skill | Evidence emitted |
|-------|-------|------------------|
| Intake | `op-issue-create`, `op-issue-triage` | Classified, prioritized backlog |
| Understand | `op-issue-research`, `op-issue-spike` | Investigation record, spike docs |
| Plan | `op-issue-plan` | **Persisted plan-of-record** + data classification + risk register |
| Build | `op-issue-implement`, `op-issue-fix` | Atomic commits linked to the issue |
| Verify | `op-verify`, `op-review`, `op-security`, `op-data-scan`, `op-pr-prep`, `op-ci` | Behavioral + review + security + regulated-data evidence |
| Trace | `op-trace` | **Requirements Traceability Matrix** |
| Control | `op-change-record` | **Change-control record** (signed) |
| Ship | `op-release`, `op-validate` | Changelog + **release validation pack** |
| Operate | `op-hotfix` | Incident record + follow-up backlog loop |

Enforcement is not advisory: a repo-side `pre-push` git hook (see `hooks/pre-push-gate.md`) runs the
coverage floor, duplication, lint, dependency audit, filesystem/secret scans, and an **AI code-review +
security-review + regulated-data gate** (scoped to the repo's compliance profile) on every push.
`--no-verify` is the only override, and it is recorded as an exception in the release validation pack.

## Control mapping

> **Canonical source:** this table is a human-readable view of
> [`controls/registry.yaml`](../controls/registry.yaml) — the machine-readable registry in which
> every control is pinned to its authoritative source (eCFR / guidance documents by checksum;
> copyrighted frameworks by clause ID only) and mapped to the skills/hooks that implement it.
> Edit the registry, not this table. **The table below is generated** by
> `controls/scripts/generate-docs.ts` (`npm run docs:generate`) — hand edits between the markers
> are overwritten and fail `npm run docs:check` in CI. Each row's Control ID keys the corresponding
> entry in `controls/registry.yaml`.

<!-- BEGIN generated:control-mapping -->

| Control ID | Framework | Control | Implemented by |
|------------|-----------|---------|----------------|
| `CTL-HIPAA-001` | HIPAA | PHI never appears in logs, prompts, or fixtures | `op-data-scan`, `pre-push-gate` (hook), audit-logger-pii-masking (arch) |
| `CTL-HIPAA-002` | HIPAA | Runtime data residency and minimum necessary for regulated data | consuming-app-runtime-residency (arch), `op-review`, `op-validate` |
| `CTL-HIPAA-003` | HIPAA | Access to PHI is restricted and reviewed at the API surface | `op-review` |
| `CTL-SOC2-001` | SOC 2 | Change management — plan, independent review, enforced gate, recorded change | `op-issue-plan`, `op-review`, `pre-push-gate` (hook), `op-change-record` |
| `CTL-SOD-001` | SOC 2 | Separation of duties — self-review is flagged and requires countersignature | `op-review`, `op-change-record` |
| `CTL-P11-001` | 21 CFR Part 11 | Requirement-to-code-to-test-to-release traceability | `op-trace` |
| `CTL-P11-002` | 21 CFR Part 11 | Electronic signatures — approvals captured as signed who/when/meaning records | `op-change-record` |
| `CTL-AIQ-001` | Part 11 / GxP (CSA) | AI tool qualification — the AI assisting this SDLC is qualified for its intended use | claude-code-tooling (arch), human-gated-skills (arch), `op-validate` |
| `CTL-CSA-001` | Part 11 / GxP (CSA) | Validation evidence — risk-based release qualification pack (CSA posture) | `op-validate` |
| `CTL-ISO-001` | ISO 62304 / 14971 | Risk management per change — risk register in every plan of record | `op-issue-plan` |
| `CTL-CCPA-001` | US state privacy (CCPA/CPRA) | Personal and sensitive personal information — definitions and handling | `op-data-scan` |
| `CTL-CCPA-002` | US state privacy (CCPA/CPRA) | Consumer rights — know, delete, correct, opt-out of sale/sharing | `op-issue-plan`, `op-review` |
| `CTL-CCPA-003` | US state privacy (CCPA/CPRA) | Reasonable security and breach liability | `op-review`, `op-hotfix` |
| `CTL-CCPA-004` | US state privacy (CCPA/CPRA) | Service-provider and contractor contract requirements | subprocessor-agreements (arch) |

<!-- END generated:control-mapping -->

## CSA, not legacy CSV

The regulatory direction of travel is *away* from document-heavy legacy **CSV** (Computer System
Validation — script every requirement, run IQ/OQ/PQ regardless of risk, and treat documentation as
the deliverable) and *toward* **CSA** (Computer Software Assurance): risk-proportionate assurance,
critical thinking over ceremony, and evidence as a byproduct of the work rather than its purpose.
FDA's *Computer Software Assurance for Production and Quality System Software* guidance — finalized
2025-09-24, pinned here as `CTL-CSA-001` and watched for revision by the upstream drift job — is the
current articulation of that shift.

This plugin is CSA-native by construction. It adds **no** validation master plan, **no** scripted
IQ/OQ/PQ document tree, **no** ceremony proportional to nothing. The risk register in every
plan-of-record scales scrutiny to impact; the evidence (plans, traceability matrices, signed change
records, release packs) falls out of normal engineering. CSA does not mean *less* validation — it
means validation *scaled to risk*: high-impact changes stay rigorous, low-impact ones stay light.
`op-validate` presents its evidence in IQ/OQ/PQ-legible terms so a GxP reader can map it, without
requiring the legacy documents those terms came from.

## Two-tier source policy and licensing

Every control is pinned to its authoritative source, but sources fall into two legal tiers:

- **Public-domain / freely-reusable** (US federal regulations via eCFR; California statute and
  regulation; EU law via EUR-Lex) — pinned by point-in-time version or checksum, and freely
  quotable. These the registry can reproduce.
- **Copyrighted** (GAMP 5, the SOC 2 Trust Services Criteria, ISO/IEC standards) — cited by clause
  identifier **only**. Their text is never vendored into this MIT-licensed repo; the `clause`
  citation schema structurally forbids a text body. This boundary is a licensing requirement, not a
  stylistic choice — an MIT repo cannot redistribute paywalled standards text.

## Drift is enforced in both directions

The control mapping is not a document that rots — CI reconciles it continuously:

- **Internal drift** (`.github/workflows/internal-drift.yml`, issue #3) runs on every PR: the
  registry validates against its schema, every control maps to a real skill/hook/gate, every control
  ID cited in a skill exists, and the generated table above matches the registry. The repo cannot
  disagree with itself and stay green.
- **Upstream drift** (`.github/workflows/upstream-drift.yml`, issue #4) runs weekly: it compares the
  live authoritative sources (eCFR amendment dates, Federal Register dockets, document checksums)
  against the committed pins and files a triage-ready issue per changed source — routed into
  `op-issue-triage`, so a regulation change becomes an ordinary intake item in this SDLC's own
  backlog. This is the automated, CSA-native replacement for a manual periodic-review ceremony.

## Two AI systems, kept distinct

An honest compliance model must not conflate the two AI systems in play:

- **The SDLC's development-time AI is Claude Code** (Anthropic's Claude) — a **hosted** model.
  Source code and diffs are sent to Anthropic's API. Its qualification (`CTL-AIQ-001`) rests on a
  recorded model/plugin version, human approval gates at every phase, versioned skills whose actions
  are recorded, and an honest data-handling posture — an organization qualifying the tool should
  assess Anthropic's data-handling terms (no training on API inputs, zero-data-retention options).
  This plugin does **not** claim source code stays inside a local trust boundary.
- **The consuming application's runtime data residency is the application's own concern**
  (`CTL-HIPAA-002`). If it processes regulated data at runtime, keeping that data in-boundary is its
  architectural responsibility. Opus Populi, for instance, runs self-hosted inference and a private
  prompt-service so PHI is not sent to a third-party model vendor *at runtime* — its implementation,
  not a property of this plugin. The SDLC reviews it (`op-review`) and records the posture in the
  release pack (`op-validate`).

Stating this plainly is itself part of the honesty guardrail: claiming the SDLC's own AI is
self-hosted would be an overclaim, and an evidence pipeline that oversells itself is a finding, not a
feature.

## Evidence layout (in the consuming repo)

```
docs/plans/<issue>-<slug>.md                     # plan-of-record (traceability anchor)
docs/compliance/traceability/<issue>-rtm.md      # requirements traceability matrix
docs/compliance/changes/<issue>-change-record.md # signed change-control record
docs/compliance/releases/<version>-validation.md # release validation / qualification pack
```

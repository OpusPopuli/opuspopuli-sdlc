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
security-review + PHI gate** on every push. `--no-verify` is the only override, and it is recorded as an
exception in the release validation pack.

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
| `CTL-HIPAA-002` | HIPAA | Data residency and minimum necessary — no PHI or code to third-party model vendors | self-hosted-models (arch), private-prompt-service (arch), `op-validate` |
| `CTL-HIPAA-003` | HIPAA | Access to PHI is restricted and reviewed at the API surface | `op-review` |
| `CTL-SOC2-001` | SOC 2 | Change management — plan, independent review, enforced gate, recorded change | `op-issue-plan`, `op-review`, `pre-push-gate` (hook), `op-change-record` |
| `CTL-SOD-001` | SOC 2 | Separation of duties — self-review is flagged and requires countersignature | `op-review`, `op-change-record` |
| `CTL-P11-001` | 21 CFR Part 11 | Requirement-to-code-to-test-to-release traceability | `op-trace` |
| `CTL-P11-002` | 21 CFR Part 11 | Electronic signatures — approvals captured as signed who/when/meaning records | `op-change-record` |
| `CTL-AIQ-001` | Part 11 / GxP (CSA) | AI tool qualification — the AI tooling itself is qualified for its intended use | self-hosted-models (arch), private-prompt-service (arch), human-gated-skills (arch), `op-validate` |
| `CTL-CSA-001` | Part 11 / GxP (CSA) | Validation evidence — risk-based release qualification pack (CSA posture) | `op-validate` |
| `CTL-ISO-001` | ISO 62304 / 14971 | Risk management per change — risk register in every plan of record | `op-issue-plan` |
| `CTL-CCPA-001` | US state privacy (CCPA/CPRA) | Personal and sensitive personal information — definitions and handling | `op-data-scan` |
| `CTL-CCPA-002` | US state privacy (CCPA/CPRA) | Consumer rights — know, delete, correct, opt-out of sale/sharing | `op-issue-plan`, `op-review` |
| `CTL-CCPA-003` | US state privacy (CCPA/CPRA) | Reasonable security and breach liability | `op-review`, `op-hotfix` |
| `CTL-CCPA-004` | US state privacy (CCPA/CPRA) | Service-provider and contractor contract requirements | subprocessor-agreements (arch) |

<!-- END generated:control-mapping -->

## The data-residency advantage

Most "AI SDLC" pipelines send every diff, prompt, and sometimes production data to a SaaS model provider —
a standing BAA and data-residency problem under HIPAA and Part 11. This lifecycle is built to run AI on
**self-hosted models** with prompt templates served from a **private, authenticated prompt service**.
Regulated data and source code stay inside the trust boundary. That is the control most competing setups
cannot claim.

## Evidence layout (in the consuming repo)

```
docs/plans/<issue>-<slug>.md                     # plan-of-record (traceability anchor)
docs/compliance/traceability/<issue>-rtm.md      # requirements traceability matrix
docs/compliance/changes/<issue>-change-record.md # signed change-control record
docs/compliance/releases/<version>-validation.md # release validation / qualification pack
```

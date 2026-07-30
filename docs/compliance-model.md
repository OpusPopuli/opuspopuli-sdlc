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
| Verify | `op-verify`, `op-review`, `op-security`, `op-phi-scan`, `op-pr-prep`, `op-ci` | Behavioral + review + security + PHI evidence |
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
> Edit the registry, not this table. (Automated generation of this view — including per-row
> registry IDs — lands with issue #2; until then the registry wins on any discrepancy.)

| Framework | Control | How it's satisfied |
|-----------|---------|--------------------|
| **HIPAA** | PHI never in logs/prompts/fixtures | `op-phi-scan` + pre-push PHI gate + audit-logger PII masking |
| **HIPAA** | Data residency / minimum necessary | Self-hosted models + private prompt service → **no PHI or code sent to a third-party model vendor** |
| **HIPAA** | Access to PHI restricted | GraphQL field-level exposure reviewed in `op-review` |
| **SOC 2** | CC8.1 change management | Plan → review → enforced gate → PR → `op-change-record` |
| **SOC 2 / Part 11** | Separation of duties | `op-review` + `op-change-record` flag self-review; require countersignature |
| **21 CFR Part 11** | Requirement→code→test→release traceability | `op-trace` RTM |
| **21 CFR Part 11** | Electronic signatures | Approvals captured as signed who/when/meaning records |
| **Part 11 / GxP (CSV/CSA)** | Validation evidence | `op-validate` release qualification pack |
| **ISO 62304 / 14971** | Risk management per change | Risk register in every `op-issue-plan` |

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

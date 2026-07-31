# Intended use & GxP impact statement

*Preamble to [`controls/registry.yaml`](registry.yaml). The registry's intended-use / GxP impact
statement. For how the plugin works technically, see [`docs/architecture.md`](../docs/architecture.md).*

## What this system is

`opuspopuli-sdlc` is a Claude Code plugin encoding an AI-assisted software development lifecycle as
versioned, human-gated skills that emit compliance evidence (plans of record, traceability
matrices, signed change records, release validation packs) as a byproduct of normal engineering
work. Its control claims are recorded in the machine-readable registry alongside this statement,
pinned to authoritative sources and reconciled against this repo's contents by CI.

## Intended use

To support disciplined, evidence-producing software development in consuming repositories,
including repositories whose products handle regulated data (e.g. US PHI) or operate in GxP
contexts. A consuming repo declares a **profile** of applicable framework families; controls
outside that profile are inert for that repo.

## GxP impact

The plugin is **development-process tooling**. It is not a medical device, does not store or
process regulated data itself, and makes no product-quality decisions autonomously — every
lifecycle gate is human-approved. Its GxP relevance is indirect: it produces the assurance
evidence (CSA posture) that consuming systems reference in their own validation.

## What this system does not claim

Installing this plugin does not make an organization compliant with HIPAA, SOC 2, 21 CFR Part 11,
or any other framework. Compliance requires policies, training, risk assessments, vendor
agreements, and an actual audit. The artifacts produced here are **audit-ready scaffolding and
evidence** — describe them as "audit-ready", never "compliant". An evidence pack that hides gaps
is a finding, not a pass.

## Two AI systems, kept distinct

Compliance readers must not conflate the two AI systems in play:

1. **The SDLC's development-time AI is Claude Code** (Anthropic's Claude). It is the AI that plans,
   builds, and reviews software when a developer runs these skills. It is a **hosted** model —
   source code and diffs are sent to Anthropic's API. Its qualification (`CTL-AIQ-001`) rests on a
   recorded model/plugin version, human approval gates at every phase (no autonomous production
   changes), versioned skills whose actions are recorded, and an **honest data-handling posture**.
   An organization qualifying this tool for regulated use should assess Anthropic's data-handling
   terms — no training on API inputs, zero-data-retention options — and decide accordingly. This
   plugin does **not** claim source code stays inside a local trust boundary.

2. **The consuming application's runtime AI is the application's own choice** (`CTL-HIPAA-002`). If
   the app processes regulated data at runtime, keeping that data in-boundary is the app's
   architectural responsibility. Opus Populi, for example, runs self-hosted inference and a private
   prompt-service so PHI is not sent to a third-party model vendor at runtime — but that is Opus
   Populi's implementation, not a property of this plugin. The SDLC's role is to review it
   (`op-review`) and record the posture in the release evidence (`op-validate`).

Distinguishing these is itself part of honest tool qualification: overstating that the SDLC's own
AI is self-hosted would be exactly the kind of overclaim the honesty guardrail above forbids.

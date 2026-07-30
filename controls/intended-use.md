# Intended use & GxP impact statement

*Preamble to [`controls/registry.yaml`](registry.yaml). Expanded by issue #5; this is the
plan-of-record minimum required by issue #1.*

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

## AI tooling qualification

The AI assisting this lifecycle is itself under control `CTL-AIQ-001`: self-hosted models, a
private authenticated prompt service, human gates on every phase, and a data-residency boundary
that keeps source code and regulated data inside the trust boundary.

# opuspopuli-sdlc

**An audit-ready, AI-assisted software development lifecycle, packaged as a Claude Code plugin.**

Most "AI coding" workflows stop at "the model wrote a function." This one encodes the *whole lifecycle* —
intake → research → plan → build → verify → review → ship → operate — as versioned, human-gated skills that
**emit compliance evidence (HIPAA / SOC 2 / 21 CFR Part 11) as a byproduct of normal work.**

Install it once and every Claude Code session — local or remote — gets the same skills, so the workflow gates
declared in each repo's `CLAUDE.md` are actually enforceable everywhere.

## What's inside

18 skills spanning the lifecycle (see [`docs/compliance-model.md`](docs/compliance-model.md) for the full
control mapping):

- **Intake** — `op-issue-create`, `op-issue-triage`
- **Understand** — `op-issue-research`, `op-issue-spike`
- **Plan** — `op-issue-plan` (persists a plan-of-record + risk register + data classification)
- **Build** — `op-issue-implement`, `op-issue-fix`
- **Verify** — `op-verify`, `op-review`, `op-security`, `op-data-scan`, `op-pr-prep`, `op-ci`
- **Trace / Control** — `op-trace` (RTM), `op-change-record` (signed change control)
- **Ship** — `op-release`, `op-validate` (release validation pack)
- **Operate** — `op-hotfix` (incident record + backlog loop)

Plus a repo-side enforcement gate: [`hooks/pre-push-gate.md`](hooks/pre-push-gate.md), and a
machine-readable **control registry** ([`controls/`](controls/README.md)) that pins every declared
control to its authoritative source (eCFR, guidance documents, framework clause IDs) with
provenance — the foundation for CI-enforced drift detection in both directions (issues #3/#4).

> The root `package.json` exists only for the registry's TypeScript tooling — this repo is a
> Claude Code plugin, not an npm package.

> Repo-specific skills stay in their home repo — e.g. `op-migration` (Supabase migration layout) lives in
> the `opuspopuli` monorepo, not here.

## Install

> The Claude Code plugin/marketplace commands evolve — verify the exact syntax against the current
> Claude Code docs. As of writing:

```
/plugin marketplace add OpusPopuli/opuspopuli-sdlc
/plugin install opuspopuli-sdlc@opuspopuli-sdlc
```

To make a repo install it automatically for everyone, add the marketplace + enabled plugin to the repo's
`.claude/settings.json` (team config), then commit it.

## The compliance angle

Compliance frameworks don't demand different engineering — they demand *provable evidence* that disciplined
engineering happened. Because each skill records what it did (plans, traceability matrices, signed change
records, validation packs), the auditor's binder assembles itself.

**Honesty guardrail:** these artifacts are audit-ready *scaffolding and evidence* — they **support** the
controls. They do not by themselves make an organization compliant; that still requires policies, training,
risk assessments, BAAs, and an actual audit.

**Data residency:** the lifecycle is built to run AI on self-hosted models with a private prompt service, so
regulated data and source code stay inside the trust boundary — no diffs or PHI shipped to a third-party
model vendor.

## License

MIT — see [`LICENSE`](LICENSE).

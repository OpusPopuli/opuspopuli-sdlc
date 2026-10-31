# opuspopuli-sdlc

**An audit-ready, AI-assisted software development lifecycle, packaged as a Claude Code plugin, with
generated skills for OpenAI Codex.**

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

Plus a repo-side enforcement gate: [`hooks/pre-push-gate.md`](hooks/pre-push-gate.md), whose AI review
stages run on Claude Code or Codex through a fail-closed reference runner
([`hooks/review-gate.ts`](hooks/review-gate.ts)), and a
machine-readable **control registry** ([`controls/`](controls/README.md)) that pins every declared
control to its authoritative source (eCFR, guidance documents, framework clause IDs) with
provenance — the foundation for CI-enforced drift detection in both directions (issues #3/#4).

For how it all fits together technically — the registry model, source adapters, the two drift gates,
the profile model, the toolchain, and how to adopt it in your own repo — see
[`docs/architecture.md`](docs/architecture.md).

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

### Using Codex

The same 18 skills ship for Codex in [`.agents/skills/`](.agents/skills/), generated from `skills/`. Codex
discovers repo skills in `.agents/skills/`, so copy them into the consuming repo and commit them:

```
git clone https://github.com/OpusPopuli/opuspopuli-sdlc ../opuspopuli-sdlc
mkdir -p .agents/skills
cp -R ../opuspopuli-sdlc/.agents/skills/op-* .agents/skills/
cp ../opuspopuli-sdlc/templates/codex/AGENTS.md AGENTS.md   # or merge into your existing AGENTS.md
```

Invoke a skill with `$op-issue-plan`, `$op-verify` and so on. Codex has no `$ARGUMENTS`, so give the input
in the request ("`$op-issue-plan` for issue 42"); each skill says what input it needs. Each copied file's
header names the plugin version it came from. To upgrade, pull this repo and copy again.

Both runtimes follow the same workflow, gates, controls and evidence; only the invocation syntax and the
AI data-handling posture recorded by `op-validate` differ. For the push-time gate on Codex, see
[`hooks/pre-push-gate.md`](hooks/pre-push-gate.md) (`--provider codex`).

**Tested with Codex:** discovery of all 18 skills (codex-cli 0.166.0). End-to-end runs of `op-issue-plan`,
`op-data-scan` and `op-verify` are the first thing to check on a real repo before rolling out wider.

## Declare your compliance profile

Each consuming repo says which frameworks apply to it in `.sdlc/compliance-profile.yaml`. Families you
don't declare stay inert: no gates, no scan categories, no evidence obligations.

```yaml
# .sdlc/compliance-profile.yaml
version: 1
repo: my-service
families: [hipaa, soc2]
```

Start from an example in [`controls/examples/`](controls/examples/), commit it, and validate it from a
checkout of this repo:

```
npm run profile:check -- --repo ../my-service
```

With no profile, the skills run the framework-agnostic lifecycle and apply the strict PHI/PII lens.

**Upgrading from 0.2.x:** the profile used to live at `.claude/compliance-profile.yaml`. Move it with
`mkdir -p .sdlc && git mv .claude/compliance-profile.yaml .sdlc/`. The old path still works but is
reported as deprecated, and if both exist the `.sdlc/` copy wins. The path belongs to no single agent
runtime, so every coding agent reads the same profile (#56).

## The compliance angle

Compliance frameworks don't demand different engineering — they demand *provable evidence* that disciplined
engineering happened. Because each skill records what it did (plans, traceability matrices, signed change
records, validation packs), the auditor's binder assembles itself.

**Honesty guardrail:** these artifacts are audit-ready *scaffolding and evidence* — they **support** the
controls. They do not by themselves make an organization compliant; that still requires policies, training,
risk assessments, BAAs, and an actual audit.

**Two AI systems, kept distinct:** this plugin's own development-time AI is **Claude Code** (Anthropic's
Claude) — a hosted model that receives source code and diffs; qualify it honestly (see `CTL-AIQ-001` and
[`docs/architecture.md`](docs/architecture.md)), don't assume it keeps code in a local boundary. Separately, a
*consuming application* that processes regulated data at runtime is responsible for its own data residency —
Opus Populi, for example, runs self-hosted inference so PHI stays in-boundary at runtime (`CTL-HIPAA-002`). The
SDLC reviews and evidences that; it does not provide it.

## License

MIT — see [`LICENSE`](LICENSE).

# Architecture & technical implementation

How `opuspopuli-sdlc` is built, for anyone cloning the repo to understand, extend, or adopt it.
For the compliance rationale (CSA posture, source/licensing policy, honesty guardrail) see
[`compliance-model.md`](compliance-model.md); this document is the engineering view.

## What this repo is

A **Claude Code plugin**: a set of versioned, human-gated **skills** (markdown instructions the AI
follows), a repo-side enforcement **hook**, a machine-readable **control registry**, and the
**TypeScript tooling + CI gates** that keep the registry honest. It is *development-process tooling*
— it stores no regulated data and makes no autonomous production changes.

```
opuspopuli-sdlc/
├── skills/                     # 18 op-* lifecycle skills (intake → operate), one SKILL.md each
├── hooks/pre-push-gate.md      # the enforcement gate consuming repos install as a git hook
├── controls/
│   ├── registry.yaml           # THE control registry — the canonical asset
│   ├── intended-use.md         # registry preamble: intended use, GxP impact, honesty guardrail
│   ├── examples/               # example consuming-repo compliance profiles
│   ├── schema/                 # JSON Schemas for the registry and for profiles
│   └── scripts/                # TypeScript tooling + co-located *.test.ts
├── docs/
│   ├── compliance-model.md     # compliance rationale (control-mapping table is generated)
│   ├── architecture.md         # this file
│   └── plans/                  # persisted plans-of-record (traceability anchors)
└── .github/workflows/          # internal-drift.yml (per-PR), upstream-drift.yml (weekly)
```

## The control registry

`controls/registry.yaml` is the single source of truth. Every control declares its framework
family, jurisdiction, applicability, authoritative citations, the skills/hooks that implement it,
and the evidence it produces. It is validated against
[`controls/schema/registry.schema.json`](../controls/schema/registry.schema.json).

| Field | Meaning |
|---|---|
| `id` | Stable `CTL-<PREFIX>-<NNN>` identifier, never reused |
| `family` | Framework family; must be declared in `profiles.families` and have a `frameworks:` label |
| `jurisdiction` / `applicability` | Open-vocabulary legal-regime and product/data-context tags |
| `citations[]` | Authoritative sources, each via a named **adapter** (below) |
| `implemented_by[]` | `skill` (file must exist), `hook` (file must exist), or `architecture` (documented posture) |
| `evidence[]` | Artifact paths the control produces in a consuming repo |
| `status` | `active`, or `pin-pending` while a pinnable citation lacks its pin |

### Source adapters

The adapter is the unit of extension — a new source *kind* is a new adapter, never a schema
redesign. `pin.ts` writes pins; `check-upstream.ts` watches them.

| Adapter | Sources | Pinned by | Watched by (#4) |
|---|---|---|---|
| `ecfr` | US federal regulations | latest amendment date via the eCFR Versioner API | newer amendment date |
| `document` | Guidance PDFs / statute pages | URL + `sha256` (`raw` bytes, or `text` = markup-stripped) | checksum change (unless `auto_poll: false`) |
| `fedreg` | Federal Register dockets | newest document number via the federalregister.gov API | new document on the docket |
| `eurlex` | EU law by CELEX/ELI | *(reserved for the GDPR pack, #7)* | *(reserved)* |
| `clause` | **Copyrighted** frameworks (GAMP 5, SOC 2 TSC, ISO) | not pinned — identifier only | not watched (manual) |

`auto_poll: false` marks a `document` source whose host blocks datacenter IPs (e.g. FDA PDFs 404
from CI runners); the watcher skips it and it is paired with a `fedreg` citation for the automated
signal. The `clause` adapter has no text field — vendoring paywalled text is a schema violation, not
a policy reminder.

### Pinning

`pin.ts` fetches each source and writes a `pinned` block (amendment date, checksum, or FR document
number) plus the check date, then flips `status` to `active`. It preserves YAML comments and writes
in a canonical, minimal-diff form (`lineWidth: 0`) so a re-pin diffs only the changed values. Pins
are produced where the network reaches the sources — normally a developer machine or a CI runner;
`pin-pending` is an honest "not yet verified against the source", never hand-write a pin.

## Compliance profiles (how a consuming repo scopes coverage)

A consuming repo declares a profile (conventionally `.claude/compliance-profile.yaml`, validated
against [`controls/schema/compliance-profile.schema.json`](../controls/schema/compliance-profile.schema.json))
naming the framework **families** that apply to it. Controls whose family is not declared are
**inert** for that repo — no gate, no scan category, no evidence obligation.

- `resolveProfile()` (`controls/scripts/profile.ts`) computes the active-vs-inert partition; it is
  unit-tested, so inertness is *demonstrable* (e.g. a CCPA-only profile provably activates SOC 2 +
  CCPA and leaves HIPAA/Part 11/GxP inert).
- Each `frameworks:` entry lists `data_classes`; `op-data-scan` scans for the union across the
  profile's declared families (`hipaa → phi-pii`, `us-state-privacy → ca-personal-information`, …).
- **No profile declared** → framework-agnostic lifecycle only (plans, change records, traceability
  always run), the strict PHI/PII scan lens, and a visible "no compliance profile declared" note.

**Honesty about enforcement:** the *contract* is code-enforced (validator + resolver), but the
skills honor a resolved profile because their prose instructs the AI to — they are markdown, not a
runtime sandbox. The docs never claim otherwise.

## Drift enforcement (the differentiator)

The control mapping is reconciled continuously, in two directions:

- **Internal drift** — `internal-drift.yml` runs `npm run check` on every PR: schema validity,
  control→skill/hook existence, skill→control-ID existence, generated-doc match, profile validity,
  and the unit tests. The repo cannot disagree with itself and stay green.
- **Upstream drift** — `upstream-drift.yml` runs `npm run drift:check` weekly: it compares the live
  sources to the pins and files a triage-ready issue per changed source (labelled `upstream-drift`,
  otherwise unlabelled so `/op-issue-triage` classifies it). It never re-pins automatically — a
  regulation change is reviewed through the lifecycle, not silently absorbed. On a fetch/API error
  it files one "watcher broken" issue rather than passing green.

## Toolchain

Single-language **TypeScript**, run via Node's native type-stripping (Node ≥ 22.6, pinned by
`.nvmrc`; `--experimental-strip-types`). **No build step.** Dependencies: `ajv` (MIT) and `yaml`
(ISC) only; tests on the built-in `node:test` runner.

| Script | What it does |
|---|---|
| `npm run validate` | Registry ↔ schema + semantic checks (offline) |
| `npm run docs:generate` / `docs:check` | Render / verify the generated control-mapping table |
| `npm run reconcile` | Registry ↔ skills/hooks/docs cross-checks (offline) |
| `npm run profile:check` | Validate a compliance profile against the registry |
| `npm run pin` | Fetch sources and write pins (network) |
| `npm run drift:check` / `drift:dry-run` | Compare live sources to pins; file issues / print only |
| `npm run registry:format` | Rewrite the registry in canonical minimal-diff form |
| `npm test` | Run the `node:test` suites (offline) |
| `npm run check` | The CI gate: validate + docs:check + reconcile + profile:check + test |

## Adopting it in your own repo

1. Install the plugin (see the README for the current `/plugin` commands) so the `op-*` skills are
   available in Claude Code.
2. Add `.claude/compliance-profile.yaml` declaring the framework families that apply to you (start
   from an example in [`controls/examples/`](../controls/examples/)). Everything outside your
   profile stays inert.
3. Install the pre-push gate ([`hooks/pre-push-gate.md`](../hooks/pre-push-gate.md)) so the
   framework-conditional checks run at push time.
4. Run the lifecycle: `/op-issue-plan` → `/op-issue-implement` → `/op-verify` + `/op-review` →
   `/op-trace` → `/op-change-record` → `/op-release` + `/op-validate`. The compliance evidence
   accumulates as a byproduct.

The registry, tooling, and drift gates in *this* repo are what keep the control mapping honest and
current; a consuming repo consumes the skills and declares its profile. Extending coverage (a new
state privacy law, a new framework) is new registry entries in an existing family or a new
adapter — not a redesign.

## The two AI systems

The AI that runs these skills is **Claude Code** (Anthropic's Claude) — hosted, so code and diffs go
to Anthropic's API; qualify it honestly (`CTL-AIQ-001`). That is distinct from a consuming
application's *runtime* AI, whose data residency is the application's own concern (`CTL-HIPAA-002`).
See [`compliance-model.md`](compliance-model.md#two-ai-systems-kept-distinct).

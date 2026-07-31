# Control registry

`registry.yaml` is the **canonical, machine-readable source** of this plugin's control mapping.
Every control is pinned to its authoritative source with provenance, mapped to the skills/hooks
that implement it, and reconciled against the rest of the repo by tooling. The prose tables in
[`docs/compliance-model.md`](../docs/compliance-model.md) are derived from this file (generation
lands with issue #2) — edit the registry, not the tables.

The registry's preamble is the [intended-use / GxP impact statement](intended-use.md).

## Layout

```
controls/
  registry.yaml            # the registry (this is the asset)
  intended-use.md          # preamble: intended use, GxP impact, honesty guardrail
  schema/registry.schema.json
  scripts/validate.ts      # offline: schema + semantic checks
  scripts/pin.ts           # network: fills pin blocks from authoritative sources
  scripts/*.test.ts        # node:test suites (offline)
```

Single-language constraint (plan-of-record #1): all tooling is TypeScript, run via Node's native
type-stripping — Node ≥ 22.6 (`--experimental-strip-types`; default-on from Node 23). No build
step. Dependencies: `ajv` (MIT), `yaml` (ISC) only.

```
nvm use              # Node 22 (see .nvmrc) — required for type-stripping
npm ci
npm run validate     # must pass offline
npm test             # must pass offline
npm run docs:check   # verify docs/compliance-model.md matches the registry (offline)
npm run pin -- --all-pending   # network required; normally run from CI
```

## Generated documentation

The **control-mapping table** in [`docs/compliance-model.md`](../docs/compliance-model.md) is
generated from this registry by `controls/scripts/generate-docs.ts` — do not hand-edit it. The
generated region is delimited by `<!-- BEGIN generated:control-mapping -->` /
`<!-- END generated:control-mapping -->`; prose outside the markers is never touched.

```
npm run docs:generate   # rewrite the table from the registry
npm run docs:check      # verify the committed table matches (exit 1 on drift) — used by CI (#3)
```

The "Framework" column comes from the `frameworks:` map in `registry.yaml` (family slug →
`{ label, sort }`); `validate.ts` fails if any control uses a family with no label, so a new pack
can't introduce a family that renders blank. Output is sorted by framework `sort` then control ID,
so regeneration is deterministic and `docs:check` is a stable equality test.

## Control entries

Each entry in `controls[]`:

| Field | Meaning |
|---|---|
| `id` | Stable identifier (`CTL-<FAMILY>-<NNN>`). Never reused, even after retirement. |
| `family` | Framework family; must be declared in `profiles.families`. |
| `jurisdiction` | Legal regime — open vocabulary (`us`, `us-ca`, `eu`, `global`, …). |
| `applicability` | Product/data contexts that trigger the control (`us-phi`, `eu-personal-data`, `samd`, `all`, …). Open vocabulary — packs add values without schema changes. |
| `citations[]` | Authoritative sources via a named **adapter** (below). |
| `implemented_by[]` | `skill` (must exist as `skills/<ref>/SKILL.md`), `hook` (`hooks/<ref>.md`), or `architecture` (posture documented in the compliance model). |
| `evidence[]` | Artifact paths the control produces in consuming repos. |
| `status` | `active`, or `pin-pending` while any pinnable citation lacks its pin. `validate.ts` enforces consistency. |

## Consuming-repo compliance profiles

A consuming repo declares which framework families apply to it in a **compliance profile**,
conventionally `.claude/compliance-profile.yaml`, validated against
`schema/compliance-profile.schema.json`. Controls whose family is not declared are **inert** for
that repo — no gate, no scan category, no evidence obligation. This is what lets one repo run a
lean privacy-only gate while the plugin carries full multi-framework capability.

```yaml
# .claude/compliance-profile.yaml — the Opus Populi launch profile (CCPA-only + SOC 2)
version: 1
repo: opuspopuli
families: [us-state-privacy, soc2]
applicability: [ca-personal-information]
```

Worked examples live in [`controls/examples/`](examples/). Validate a profile against the registry:

```
npm run profile:check -- .claude/compliance-profile.yaml   # one file
npm run profile:check                                        # all committed examples (used by CI)
```

**What "inert" is — honestly.** Inertness has two layers, and only the first is code-enforced:

- **Code layer:** `validate-profile.ts` rejects a profile naming a family the registry lacks, and
  `resolveProfile()` (in `profile.ts`) computes the exact active-vs-inert partition of controls,
  data classes, and evidence obligations. This partition is unit-tested — inertness is
  *demonstrable*, e.g. the Opus Populi profile provably activates SOC 2 and leaves HIPAA/Part 11/GxP
  inert.
- **Instruction layer:** the scan/review/validate skills honor the resolved profile because their
  prose instructs the AI to — they are markdown, not a runtime sandbox. We do not claim otherwise.

**Data classes and the scan.** Each `frameworks:` entry may list `data_classes` — the regulated-data
categories that family brings into scope for `op-data-scan`. The scan applies the union of data
classes across the profile's declared families (`hipaa → phi-pii`, `us-state-privacy →
ca-personal-information`; `gdpr → eu-personal-data` arrives with #7).

**Extensible state-privacy family.** The `us-state-privacy` family holds California's CCPA/CPRA
controls (`CTL-CCPA-*`). It is designed to grow: another state law (e.g. Virginia CDPA, Colorado
CPA) is added as new `CTL-<STATE>-*` control entries in the same family — no schema change, no new
adapter. A consuming repo in that state adds the family to its profile; nothing else moves.

**No profile declared:** the default is the framework-agnostic lifecycle only (plans, change
records, traceability always run); the strict PHI/PII scan lens is used, and evidence packs carry a
visible "no compliance profile declared" note.

## Source adapters

The adapter is the unit of extension: a new source *family* means a new adapter, never a schema
redesign.

| Adapter | Sources | Pin | Drift watch (#4) |
|---|---|---|---|
| `ecfr` | US federal regulations (public domain) | latest `amendment_date` for the part/section via the [eCFR Versioner API](https://www.ecfr.gov/developers/documentation/api/v1) | poll for newer amendment dates |
| `eurlex` | EU law by CELEX/ELI (freely reusable) — reserved for packs #7/#9 | consolidation date | poll for newer consolidated versions |
| `document` | Public guidance docs / statute pages | `sha256` + retrieval date; `normalization: raw` (bytes, PDFs) or `text` (markup-stripped, HTML — template churn doesn't fire false alarms) | re-fetch and compare checksum |
| `clause` | **Copyrighted** frameworks (GAMP 5, SOC 2 TSC, ISO/IEC standards) | none — identifier only | none (manual new-edition checks) |

### The no-vendoring boundary

US federal regulations and EU law are public domain / freely reusable — those we pin and may
vendor. GAMP 5, the SOC 2 TSC, and ISO/IEC standards are **copyrighted**: they are cited by
clause identifier only, forever. This is enforced structurally — the `clause` citation schema
admits no text field (`additionalProperties: false`), and `validate.ts` additionally rejects
suspiciously long field values. Vendoring paywalled text into this MIT repo is a schema
violation, not just a policy.

## Pinning workflow

Development sandboxes may have restricted egress (ecfr.gov is blocked in ours), so entries are
seeded `pin-pending` and `pin.ts` runs where the network allows — normally a GitHub-hosted
runner via `workflow_dispatch`. `pin.ts` preserves YAML comments and flips
`status` to `active` when a control's last pin lands. A `pin-pending` entry is an honest
statement that the citation has not yet been verified against the source — never hand-write a
pin block.

## Upstream drift watch

`.github/workflows/upstream-drift.yml` runs weekly (and on `workflow_dispatch`) and calls
`check-upstream.ts`, which compares the **live** authoritative sources against the committed pins —
eCFR latest amendment dates and FDA/CPPA document checksums, via the same primitives `pin.ts` uses.

```
npm run drift:dry-run   # fetch live, print drift, file nothing (safe to run anywhere with egress)
npm run drift:check     # the CI entry point — files issues (needs GITHUB_TOKEN + GITHUB_REPOSITORY)
```

When a source has changed, the watcher **files a triage-ready GitHub issue** (one per source,
deduped by title, labelled `upstream-drift` and otherwise unlabelled so `/op-issue-triage` picks it
up) naming the old/new value and the affected control IDs. It **never re-pins automatically** — a
regulation change is reviewed through the SDLC's own lifecycle (triage → plan → fix, where re-pinning
via `npm run pin` is part of the fix), not silently absorbed. On a fetch/API error it files a single
"watcher broken" issue rather than passing green. Copyrighted frameworks (`clause` adapter) are not
polled — their text is not fetchable, so new-edition checks stay manual. This is the automated,
CSA-native replacement for a manual periodic-review ceremony.

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

**Profiles:** a consuming repo declares which `families` apply to it. Controls outside the
declared profile are inert for that repo — a repo with no EU exposure gets no EU gates.

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
runner via `workflow_dispatch` (wired up with #4). `pin.ts` preserves YAML comments and flips
`status` to `active` when a control's last pin lands. A `pin-pending` entry is an honest
statement that the citation has not yet been verified against the source — never hand-write a
pin block.

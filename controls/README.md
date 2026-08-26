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
| `implemented_by[]` | `skill` (must exist as `skills/<ref>/SKILL.md`), `hook` (`hooks/<ref>.md`), or `architecture` (posture documented in the compliance model). **The named skill/hook must also cite the control ID back** — `reconcile` checks both directions (#48). |
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
| `ecfr` | US federal regulations (public domain) | latest `amendment_date` for the part/section via the [eCFR Versioner API](https://www.ecfr.gov/developers/documentation/api/v1) | poll for **any** disagreement with the pinned date (#51) |
| `eurlex` | EU law by CELEX/ELI (freely reusable) — reserved for packs #7/#9 | consolidation date | poll for newer consolidated versions |
| `document` | Public guidance docs / statute pages | `sha256` + retrieval date; `normalization: raw` (bytes, PDFs) or `text` (markup-stripped, HTML — template churn doesn't fire false alarms) | re-fetch and compare checksum; plus `asserts` / `reverify_days` (below) |
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

**Re-pinning.** `pin.ts` skips any citation that already has a `pinned:` block, so the re-pin step
that upstream-drift remediation calls for needs `--repin`:

```
npm run pin -- CTL-CSA-001 --repin    # re-fetch and overwrite this control's pins
```

`--repin` requires an explicit control ID — it overwrites verified pins, so it is deliberately not a
bulk operation, and `--all-pending` (the CI path) still cannot overwrite anything.

**A checksum proves immutability, not accuracy.** Two fields exist because `CTL-CSA-001` was pinned
to the correct bytes of the February 2026 FDA CSA guidance while being *labelled* as the September
2025 guidance that document superseded — a mislabelling that eight clean weekly drift runs could not
possibly have caught (#41):

| Field | What it does |
|---|---|
| `asserts: { title, issued, version }` | The document's **self-declared** identity. Re-verification extracts text from the fetched document and fails if it doesn't corroborate these. The `issued` check also treats a date named in the document's *supersession clause* as a failure — a revision quotes the date of the version it replaces, so plain containment is not enough. `version` is the document's own statement of which version it is: for California statutes, the enactment line (`Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824)`), which is version-specific by construction and so cannot pass vacuously the way a title can. |
| `reverify_days` | Maximum age of `pinned.retrieved` before the watch files a "pin re-verification overdue" issue. **Required in practice on every `auto_poll: false` citation** — without it, "CI can't check this" silently becomes "nobody checks this". A test enforces it. |

Verify manual sources from a network the host doesn't block:

```
npm run drift:dry-run -- --include-manual   # fetch auto_poll:false sources, compare checksums, verify asserts
```

**Write assertions from the source, never from memory.** Every assertion in this registry was tested
against live text before being committed, and negative-controlled: perturb each field and confirm the
check fails. An assertion nobody verified is the exact defect `asserts` exists to prevent. Where a
document's text genuinely cannot corroborate a claim — the CPPA regulations PDF extracts its body but
not its edition date — assert only what *is* corroborated and record the gap in the citation `note`.
An assertion that looks verified but isn't is worse than none.

`pin.ts` writes registry.yaml in a **canonical serialized form** (`lineWidth: 0`, no line-wrapping)
so a re-pin diffs only the changed pin values, not re-flowed paragraphs. A test enforces the
committed file is already canonical; if you hand-edit and it drifts, run `npm run registry:format`.

## Upstream drift watch

`.github/workflows/upstream-drift.yml` runs weekly (and on `workflow_dispatch`) and calls
`check-upstream.ts`, which compares the **live** authoritative sources against the committed pins —
eCFR latest amendment dates and FDA/CPPA document checksums, via the same primitives `pin.ts` uses.

```
npm run drift:dry-run   # fetch live, print drift, file nothing (safe to run anywhere with egress)
npm run drift:check     # the CI entry point — files issues (needs GITHUB_TOKEN + GITHUB_REPOSITORY)
```

### Cadence — how often each source is polled

Sources move at very different rates, so cadence is **declared per source** rather than applied
uniformly (#53). Measured over ~10 years of eCFR history:

| Source | Changes | Tier |
|---|---|---|
| 21 CFR part 820 (QMSR) | 5 — three since 2024 | `weekly` |
| 45 CFR §164.502 | 3 — two in 2024 | `monthly` |
| 21 CFR §11.10, §11.50 | 1 each, 2016 | `quarterly` |
| 45 CFR §164.312 | 1, 2016 | `quarterly` |

```yaml
drift:
  default_cadence: monthly     # applies to any polled citation that declares none

- adapter: ecfr
  cfr_part: "820"
  cadence: weekly              # justify the tier in a comment — a tier with no reason is a guess
```

Each tier has its own cron in `.github/workflows/upstream-drift.yml`; the workflow maps the firing
cron to a tier and passes `--cadence=<tier>`. Running `drift:check`/`drift:dry-run` with no flag (or
`--cadence=all`) polls **everything**, so a human never gets a partial answer without asking for one.
An unmapped cron falls through to `all`: over-polling wastes a request, under-polling misses a
regulation change, so the failure mode is biased toward the former. A test asserts the tiers partition
every source exactly once and that the workflow's cron↔tier map matches the cadence enum.

> **This is an efficiency choice, not a robustness improvement, and the trade is real.** A `quarterly`
> source can be stale for up to a quarter before the watch notices. Weekly polling of everything cost
> ~570 requests a year to catch 1–2 actual events, which is why the default moved to `monthly` — but
> nothing here detects a change *faster* than before, and several sources are now detected slower.
> Note also that frequency was never the binding constraint on the failure this repo actually had: the
> CSA supersession (#41) survived five months of weekly polling because the gap was structural
> (`auto_poll: false`, no assertions), not temporal. Cadence tuning does not substitute for coverage.

**Amendment dates are per *section*, not per part.** Sections of one part have independent histories:
21 CFR §11.1 (`2022-02-01`) and §11.100 (`2023-03-02`) carry later dates than §11.10 and §11.50
(`2016-12-29`), and the part-level authority line lists FR actions for all of them together. Pin the
date the Versioner API returns *for the cited section*; never copy a date from a part-level authority
line or from a neighbouring section. A pin **ahead** of the source is drift too — eCFR cannot serve an
earlier date than one it published, so that direction means the pin is wrong, and the issue says so
rather than telling you to re-pin to match (#51).

When a source has changed, the watcher **files a triage-ready GitHub issue** (one per source,
deduped by title, labelled `upstream-drift` and otherwise unlabelled so `/op-issue-triage` picks it
up) naming the old/new value and the affected control IDs. It **never re-pins automatically** — a
regulation change is reviewed through the SDLC's own lifecycle (triage → plan → fix, where re-pinning
via `npm run pin` is part of the fix), not silently absorbed. On a fetch/API error it files a single
"watcher broken" issue rather than passing green — and that issue **names every control whose pin the
failure left unverified**, with its pinned value and last-verified date, because a fetch failure is a
statement about our evidence and not just about the network. It says explicitly that restoring the
fetch does not resolve it, and that silencing the poll resolves it even less: closing requires
re-verification via `--include-manual` and, if the source moved, a `--repin`. (#20 named no control at
all, which is how #21 restored a signal, closed the issue, and left a mislabelled pin in place — #42.)
Copyrighted frameworks (`clause` adapter) are not
polled — their text is not fetchable, so new-edition checks stay manual. This is the automated,
CSA-native replacement for a manual periodic-review ceremony.

**What it cannot do.** The watch answers "did this source change since we pinned it?" — never "did we
describe it correctly when we pinned it?". Sources it cannot fetch (`auto_poll: false`) it does not
check at all; it reports them as overdue via `reverify_days` and a human clears them with
`--include-manual`. Treat a green weekly run as evidence that nothing moved, not as evidence that the
registry is right. The `fedreg` adapter in particular watches *docket activity*, which is a proxy: FDA
issued the 2026-02-02 CSA revision with no new notice on docket `FDA-2022-D-0795`, so that signal
provably did not fire for it. A proxy signal supplements the artifact checksum; it never replaces it.

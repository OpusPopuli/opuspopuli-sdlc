# Plan of record: machine-readable control registry (#1)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#1](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/1) |
| **Date** | 2026-07-30 |
| **Author** | Claude (AI-assisted, human-approved via issue/plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-30 |
| **Data classification** | None — no PHI/PII/regulated data; public regulatory citations and tooling only |
| **Branch** | `claude/system-validation-sdlc-msmybo` |

**Stated constraint (applies to #2–#4 and all framework packs):** single-language TypeScript
toolchain — `.ts` scripts run via Node's native type-stripping (Node ≥ 22.6 with
`--experimental-strip-types`; default-on from Node 23, Node 24 LTS in CI). No build step. Permissive
dependencies only (`ajv` MIT, `yaml` ISC); tests on the built-in `node:test` runner.

**Scope guard:** seed = HIPAA / Part 11 / SOC 2 / existing ISO citations only. Doc generation (#2),
CI drift gates (#3, #4), and framework packs (#7–#9) are out of scope, but the schema must
anticipate them (adapter abstraction, jurisdiction/applicability axis, profiles).

## Subtasks

1. **Registry schema + documentation** — `controls/schema/registry.schema.json` (JSON Schema) and
   `controls/README.md`. Control entries: `id`, `title`, `family`, `jurisdiction`, `applicability`,
   `citations[]`, `implemented_by[]`, `evidence[]`, `status`. Citations carry a named **adapter**
   (`ecfr` | `document` | `clause` | reserved `eurlex`) with adapter-specific pin fields. The
   `clause` adapter structurally forbids a text body — the no-vendoring boundary is enforced by
   schema, not convention. `profiles` section defines declarable framework families.
2. **Validation + pin tooling** — `controls/scripts/validate.ts` (schema + semantic checks, fully
   offline) and `controls/scripts/pin.ts` (fetch source, compute sha256 / amendment date, write pin
   block). Tests in `controls/scripts/*.test.ts` on `node:test`, offline.
3. **Seed the registry** — `controls/registry.yaml` with every row of the pre-existing
   control-mapping table in `docs/compliance-model.md`, plus the AI-tool qualification entry.
   eCFR pins for 21 CFR Part 11 and 45 CFR 160/164; document pin for the FDA CSA guidance.
4. **Intended-use / GxP impact statement** — `controls/intended-use.md`, referenced as the
   registry preamble (expanded later by #5).
5. **Wire-in, not rewrite** — minimal edits to `docs/compliance-model.md` and `README.md`
   declaring the registry canonical; full doc generation is #2.

Not applicable: services/packages, schema migrations, GraphQL/federation — docs-and-tooling repo.

## Risk register (severity × likelihood → mitigation)

1. Schema too rigid for extension packs — **medium × possible** → GDPR dry-run fixture (`eurlex`
   citation, `EU-personal-data` applicability) validated as a test case without entering the
   registry; if it fits, #7–#9 fit.
2. Sandbox egress blocks source fetching for pins (ecfr.gov confirmed blocked in the dev sandbox) —
   **medium × likely** → `pin.ts` designed to run on GitHub-hosted runners (workflow_dispatch);
   entries carry `status: pin-pending` until CI-produced pins are committed; acceptance criterion
   is met before the PR merges, not before the first commit.
3. Copyright breach by vendoring paywalled text — **high × rare** → structurally prevented: the
   `clause` citation schema rejects any text body; `validate.ts` enforces it as a semantic check too.
4. Interim drift between registry and prose docs until #2/#3 land — **medium × likely** →
   compliance-model gains an explicit "registry is canonical" note; #2 and #3 sequenced next.
5. Stale/wrong citation in the seed — **medium × possible** → pinned citations verified by
   checksum/amendment date at pin time; #4's scheduled watcher re-verifies thereafter.
6. License contamination in tooling deps — **low × rare** → `ajv` (MIT), `yaml` (ISC) only; no
   AGPL. Native type-stripping requires Node ≥ 22.6 (**low × rare**) → `engines` pin + Node 24 LTS
   in CI.

## Effort

One to two focused sessions: schema + tooling ≈ one; seed + pins + wire-in ≈ one.

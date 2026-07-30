# Plan of record: generate the compliance-model control tables from the registry (#2)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#2](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/2) |
| **Date** | 2026-07-30 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-30 (option A: framework labels live in the registry) |
| **Data classification** | None — reads `controls/registry.yaml` (public citations), writes Markdown. No PHI/PII/regulated data. |
| **Branch** | `feat/2-generate-compliance-tables` |
| **Depends on** | #1 (merged) |

**Constraint (from plan-of-record #1):** single-language TypeScript toolchain, Node ≥ 22.6 native
type-stripping, no build step, deps limited to `ajv` (MIT) + `yaml` (ISC).

**Design decision (approved — option A):** framework display labels live in the registry (a new
additive `frameworks:` map), not in the generator. Preserves the "edit the registry, not the
table" invariant; `validate.ts` enforces that every family used by a control has a label.

## Subtasks

1. **Shared registry loader** — extract `controls/scripts/registry.ts` (load + parse + shared TS
   types) and consume it from `validate.ts` and `pin.ts`. Small DRY refactor; the generator and
   #3/#4/#7 all read the registry. Existing suites must stay green.
2. **Framework labels (option A)** — additive `frameworks:` map (family-slug → `{ label, sort }`)
   in `registry.yaml`, `schema/registry.schema.json`, and a `validate.ts` completeness check
   (every control's family resolves to a label). Backward-compatible; existing entries + GDPR
   dry-run test still validate.
3. **Generator** — `controls/scripts/generate-docs.ts`: read registry → render the control-mapping
   table (columns: **Control ID · Framework · Control · Implemented by**), sorted by control ID,
   deterministic (no timestamps) → replace content between
   `<!-- BEGIN generated:control-mapping -->` / `<!-- END generated:control-mapping -->` markers in
   `docs/compliance-model.md`. Aborts loudly on missing/unbalanced markers; writes only between
   them. `--check` flag renders-and-compares, exits non-zero with a diff (CI wiring is #3).
4. **Wire doc + scripts** — insert markers in `docs/compliance-model.md` around the generated
   table; add `docs:generate` / `docs:check` to `package.json`; note "table is generated" in
   `controls/README.md`.
5. **Tests** — `generate-docs.test.ts`: idempotency (generate twice → identical), `--check` passes
   on the committed doc, `--check` fails on a mutated registry, missing-marker case handled.

**Scope guard:** only the **control-mapping** table is registry-derived. The "lifecycle as skills"
table and "evidence layout" have no registry model — they stay hand-written and out of scope
(possible future enhancement).

## Risk register (severity × likelihood → mitigation)

1. Additive schema change breaks existing validation/tests — **low × possible** → optional field,
   families array untouched; full `validate` + `test` before commit.
2. Output not byte-stable (map/key ordering) — **medium × possible** → explicit sort by control ID
   + fixed column order; idempotency test asserts generate-twice equality.
3. Marker replacement corrupts hand-written prose — **medium × possible** → abort if markers
   absent/unbalanced; test covers it; write only between markers.
4. Manual edits reintroduce drift — **medium × likely** (the point) → `--check` exits non-zero; #3
   enforces in CI; README warns the table is generated.
5. A future pack adds a family with no label — **low × likely** → completeness check makes it a
   hard failure, not silent drift.
6. AGPL / dependency constraint — **low × rare** → no new deps; reuses `ajv` / `yaml`.

## Effort

~1 focused session (1.5 if the schema touch-ups run long).

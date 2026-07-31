# Plan of record: internal drift gate (#3)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#3](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/3) |
| **Date** | 2026-07-30 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-30 (include `npm test` in the gate; evidence-path mismatch is an error) |
| **Data classification** | None — reads repo files (public), no data written, no network, no secrets beyond `GITHUB_TOKEN`. |
| **Branch** | `feat/3-internal-drift-gate` |
| **Depends on** | #1, #2 (both merged) |

**Constraint (plan-of-record #1):** single-language TypeScript toolchain, Node ≥ 22.6 native
type-stripping, no build step, deps limited to `ajv` (MIT) + `yaml` (ISC).

## What already exists vs. new

Existing tooling already satisfies three criteria — `npm run validate` (schema + forward
"every control maps to an existing skill/hook" check) and `npm run docs:check` (generated-doc
match). New work is the two **reverse-direction** checks and the workflow.

Note: no `CTL-` references exist in skills/hooks yet, so the reverse control-ID check passes
vacuously today — but it must exist now so it bites when packs #7-#9 begin citing control IDs.

## Subtasks

1. **`controls/scripts/reconcile.ts`** — cross-repo reconciliation (distinct from `validate.ts`,
   which is registry-internal):
   - *Reverse control-ID check*: scan `skills/**/SKILL.md` + `hooks/**` for `CTL-[A-Z0-9]+-\d{3}`
     tokens; every one must exist in the registry. Failure names file + unknown ID.
   - *Evidence-path agreement*: collect `docs/compliance/**` paths referenced in skills, normalize
     placeholders (`<issue>`/`<version>` → `*`) to the registry's glob form, require each to be
     declared in some control's `evidence[]`. Failure names skill + orphan path. **Error-level**
     (approved).
   - Exports pure functions for tests; `main()` prints findings, exits 1 on any. Reuses
     `registry.ts`.
2. **npm scripts** — add `reconcile`, and a bundled `check` = `validate && docs:check && reconcile
   && test` (single entry point for CI and contributors).
3. **`controls/scripts/reconcile.test.ts`** — unknown-`CTL-` fails; valid citation passes; orphan
   evidence path fails; placeholder normalization works.
4. **`.github/workflows/internal-drift.yml`** — repo's first workflow. Triggers: `pull_request` +
   `push` to `main`. Single job: checkout, `setup-node` with `node-version-file: .nvmrc`,
   `npm ci`, `npm run check`. Concurrency group cancels superseded runs. Third-party actions pinned.
5. **`hooks/pre-push-gate.md`** — explicitly-scoped note that contributors *to this plugin repo*
   run `npm run check` before pushing (distinct from the consuming-repo gate the file documents).

**Scope guard:** file-system reconciliation only. No changes to skill behavior, registry content,
or the generator.

## Risk register (severity × likelihood → mitigation)

1. Evidence-path check false positives from placeholder/format mismatch — **medium × likely** →
   explicit `<...>`→`*` normalization, set-based compare, scoped to `docs/compliance/**`;
   unit-tested.
2. Workflow silently fails to fail the PR (misconfig) — **medium × possible** → verify on-branch by
   pushing an intentional drift and confirming the check goes red before merge.
3. CI Node ≠ toolchain Node — **low × possible** → `setup-node` `node-version-file: .nvmrc`, single
   source of truth.
4. Third-party action supply chain — **low × rare** → pin `actions/checkout` + `actions/setup-node`
   to a released major; no other actions. No AGPL/dependency change (reuses `ajv`/`yaml`).
5. "No network egress" vs. `npm ci` — **low × rare** → criterion refers to the *checks* (fully
   offline, unlike #4's pin job); dependency install is standard CI with `cache: npm`.

## Effort

~1 focused session.

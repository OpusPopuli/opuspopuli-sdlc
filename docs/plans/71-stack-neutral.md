# Plan of record: stack-neutral SDLC (#71)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#71](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/71) |
| **Date** | 2026-11-01 |
| **Author** | Claude Code (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-11-01 ("implement 71"; scope as filed) |
| **Data classification** | None. Tooling and markdown. |
| **Branch** | `feat/stack-neutral-71` |

## What is stack-specific today

| Where | Assumes |
|---|---|
| `hooks/pre-push-gate.md` stages 1–4 | `pnpm test`, `pnpm jscpd`, SonarJS, `pnpm audit` |
| `op-security` | `pnpm audit`, `pnpm.overrides`, a hardcoded AGPL/GPL rule |
| `op-pr-prep`, `op-issue-fix` | `pnpm lint && pnpm test && pnpm build`; GraphQL/Supabase checks |
| `op-issue-plan`, `op-issue-spike`, `op-issue-research` | GraphQL federation, NestJS, pgvector, AGPL-3.0 |
| `op-review`, `op-data-scan`, `op-verify` | "TypeScript strictness"; GraphQL resolvers as the only API surface; `supabase/seed*` |

## Design

1. **`.sdlc/stack.yaml`** next to the compliance profile: a `preset` for a single-stack repo, or
   `workspaces` (path + preset each) for a polyglot one; optional `commands` overrides per stage,
   where `off` disables a stage on the record; and `licence.forbidden`, a list of SPDX IDs.
2. **Stages:** `test` (coverage floors live in the build config and fail the test command),
   `lint`, `duplication`, `dependency-audit`, `licence-check`.
3. **Presets:** `node-pnpm`, `node-npm`, `java-maven`, `java-gradle`. The Java presets use the
   standard plugins (JaCoCo, Checkstyle, SpotBugs, PMD CPD, OWASP Dependency-Check, a licence
   plugin) and prefer the wrapper (`./mvnw`, `./gradlew`) when present.
4. **`hooks/stack.ts`**: standalone and vendored like the other hooks. `show` prints the resolved
   plan; `run <stage|all>` runs it. With no `stack.yaml` it detects one stack from root build files
   and says so; zero or several matches are an error, so polyglot repos must declare.
5. **Fail closed:** a config error, an unknown preset or a failing command blocks. A disabled stage,
   or one a preset does not define, is reported as skipped, never silently passed.
6. **Skills:** commands come from the stack. Domain lenses become conditional ("if the repo exposes
   GraphQL…"), and repo-specific lenses belong in `.sdlc/review/*.md` (#63). The licence rule reads
   `licence.forbidden` instead of assuming AGPL.
7. **Guard test:** no skill names a package manager or build tool outside a marked
   `<!-- stack-examples -->` block.

## Risk register (severity × likelihood → mitigation)

1. **Java preset commands wrong for a real build** — high × possible → this sandbox cannot reach
   Maven Central, so the Java presets are structurally tested only (resolution, wrapper choice,
   fail-closed exit codes with stub tools). Recorded as unverified; first run on a real Gradle/Maven
   repo before rollout. Every command can be overridden per repo.
2. **opuspopuli's gate changes behaviour** — medium × possible → its `.husky/pre-push` keeps its own
   stages until it adopts `stack.yaml`; adoption is a separate PR there.
3. **Mini YAML parser misreads a stack file** — medium × possible → the supported subset is
   documented, anything else is refused, and tests compare against the real `yaml` parser.
4. **Skills lose useful specificity** — medium × likely → specifics move into conditionals and
   `.sdlc/review/*.md`, not into nothing.
5. **Dependency/licence risk** — low × rare → none added to this repo; the presets call each
   ecosystem's standard tools.

## Effort

One to two focused sessions.

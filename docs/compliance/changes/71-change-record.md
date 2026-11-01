# Change record: stack-neutral SDLC

| Field | Value |
|---|---|
| **Change ID** | `CHG-71` |
| **Title** | `.sdlc/stack.yaml` + `hooks/stack.ts`: gate build stages and skill commands for pnpm, npm, Maven, Gradle and polyglot repos |
| **Issue** | [#71](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/71) |
| **Plan** | [`docs/plans/71-stack-neutral.md`](../../plans/71-stack-neutral.md) |
| **Branch** | `feat/stack-neutral-71` |
| **Date** | 2026-11-01 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001`, `CTL-PCI-002`, `CTL-PCI-003` |

## What changed and why

The compliance core was language-neutral, but the gate's build stages and several skills assumed the
`opuspopuli` TypeScript/pnpm stack. A Java backend with an Angular frontend had to rewrite them by
hand. A repo now declares its stack once; the gate and the skills read it.

- **`hooks/stack.ts`** resolves `.sdlc/stack.yaml`: presets `node-pnpm`, `node-npm`, `java-maven` and
  `java-gradle`; `workspaces` for polyglot repos; per-stage overrides, with `off` recorded as skipped;
  a `licence.forbidden` SPDX list; wrapper preference (`./mvnw`, `./gradlew`); detection of a single
  stack when no file exists. Stages: `build`, `test`, `lint`, `duplication`, `dependency-audit` and
  `licence-check`. It fails closed on config errors, unknown presets or stages, missing workspaces and
  failing commands.
- **Gate spec stages 1–4** run through the stack runner; a preset table and
  **`templates/gate/pre-push`**, a complete reference gate for any stack, are added.
- **Skills:** `op-security`, `op-pr-prep`, `op-issue-fix`, `op-issue-plan`, `op-issue-spike`,
  `op-issue-research`, `op-review`, `op-data-scan` and `op-verify` take commands from the stack, read
  the licence policy instead of assuming AGPL, and treat GraphQL, federation and Supabase as cases of
  "API contract" and "seed data", not as the only ones.
- **Guard:** a test fails if any skill names a package manager or build tool outside a marked
  `<!-- stack-examples -->` block.

## Changes

| File | Change |
|---|---|
| `hooks/stack.ts`, `hooks/stack.test.ts` | New runner; 25 tests |
| `controls/scripts/stack-neutral.test.ts` | Guard; 2 tests |
| `controls/examples/*.stack.yaml` | pnpm monorepo, Maven service, Gradle + Angular |
| `controls/scripts/validate-profile.ts` | Example discovery limited to `*.compliance-profile.yaml` |
| 9 skills | Stack-neutral wording; commands from the stack |
| `hooks/pre-push-gate.md` | Stages 1–4, preset table, install via the reference gate |
| `templates/gate/pre-push`, `templates/codex/AGENTS.md` | Reference gate; AGENTS.md points at the stack |
| `README.md`, `docs/architecture.md`, `controls/README.md` | "Declare your stack" how-to; layout |
| `.agents/skills/*` | Regenerated |
| `.claude-plugin/plugin.json` | 0.9.0 → 0.10.0 |

## Data classification

**None.**

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | Java preset commands fail on a real build | high × possible | **Not run against a real Maven/Gradle build:** this sandbox cannot reach Maven Central or the Gradle plugin portal. Tested structurally (resolution, wrapper choice, exit codes, end-to-end gate with a stub `gradlew`). First run on a real Java repo before rollout; every command can be overridden per repo |
| 2 | `opuspopuli`'s gate changes | medium × possible | It keeps its own `.husky/pre-push`; adopting `stack.yaml` there is a separate change |
| 3 | The YAML subset misreads a stack file | medium × possible | Unsupported constructs refused; tests compare with the real `yaml` parser |
| 4 | Skills lose useful specificity | medium × likely | Specifics moved into conditionals and `.sdlc/review/*.md` |

## Verification evidence

- `npm run check`: all gates green; 227 tests.
- On a copy of `opuspopuli` with `controls/examples/opuspopuli.stack.yaml`: `show` resolves the repo's own
  commands; `run dependency-audit` ran `pnpm audit` for real and passed, matching CI; with no stack file,
  detection picks `node-pnpm` and says so.
- Reference gate end to end in a scratch Gradle + Angular repo: a planted `LOGGER.info(…, p.getMrn())`
  blocks at 6b; the clean change passes every stage through both AI reviews; a failing backend test
  blocks at stage 1.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Consumers that vendored `stack.ts` keep their copy; skills revert to the pnpm wording.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-11-01 | Attests all gates pass and the verification above |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

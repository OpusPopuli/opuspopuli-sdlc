# Plan of record: provider-neutral, fail-closed AI review gate (#58)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#58](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/58) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-10-31 ("go forth") |
| **Data classification** | None in this repo. The runner sends a consuming repo's diff to the configured hosted model, the same exposure the gate already had with `claude --print` (see `CTL-AIQ-001`). |
| **Branch** | `feat/provider-neutral-review-gate-58` (stacked on #56) |

## The defect

Gate stages 7–8 were specified as `claude --print`, which is runtime-coupled, and the spec said nothing
about a review that fails to complete. A missing CLI, a crash, a timeout or an unparseable answer had
no defined outcome, so an implementation could pass a push that was never reviewed.

## Deliberate choices

- **One interface, two providers.** Diff → profile → provider → normalized result → policy → evidence.
- **Fail closed on every incomplete outcome.** Checked before the verdict is read, so a partial answer
  cannot pass. An empty diff is the one pass without a provider call: nothing was pushed to review.
- **Severity outranks verdict.** A critical/high finding blocks even if the model says `pass`; a `block`
  verdict blocks even with only low findings. The stricter signal wins.
- **Standalone reference file.** Built-ins only, no plugin imports, so consumers vendor one file. The
  gate stays per-repo, as before; only its reference implementation is new.
- **Codex constrained by `--output-schema`, read-only sandbox, `-o` for the final message.** The answer
  is read from a file, not scraped from a log stream.
- **Minor bump (0.3.0 → 0.4.0).** New distributed hook content.

## Subtasks

1. `hooks/review-gate.ts`: `parseResult`, `decide`, `providerCommand`, `runReview` (injectable executor), CLI.
2. `hooks/review-gate.test.ts`: every fail-closed row, severity policy, command shape, prompt, args.
3. `npm test` covers `hooks/*.test.ts`.
4. `hooks/pre-push-gate.md`: stages 7–8 rewritten; fail-closed table; husky how-to.
5. README and `architecture.md`; version bump; change record.

## Risk register (severity × likelihood → mitigation)

1. **The gate passes a push that was never reviewed** — critical × likely without this → fail-closed
   decision table, unit-tested per row and exercised end to end with stub CLIs.
2. **Fail-closed blocks legitimate pushes when a provider is down** — medium × possible → the block
   names the cause; `--no-verify` remains the logged override, unchanged.
3. **Provider CLI flags drift between versions** — medium × possible → flags verified against
   `codex-cli 0.166.0 exec --help`; any drift surfaces as a non-zero exit, which blocks rather than passes.
4. **Prompt injection in the diff tells the model to return pass** — medium × possible → severity is
   still parsed from findings; the deterministic stages 1–6 are unaffected; residual risk recorded.
5. **Dependency/licence risk** — low × rare → none added.

## Effort

One focused session.

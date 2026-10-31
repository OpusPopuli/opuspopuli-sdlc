# Plan of record: deterministic regulated-data scanner (#70)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#70](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/70) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-10-31 ("go ahead as planned") |
| **Data classification** | None in this repo. The scanner reads consuming repos' diffs locally and sends nothing anywhere. |
| **Branch** | `feat/data-scan-70` |
| **Related** | #71 (stack-neutral skills), #62 (assurance mechanism per control) |

## The gap

Every regulated-data check was prompt-driven: `op-data-scan` and the gate's AI security lens. They catch
what needs judgment, but they are not repeatable, they can be steered by the content they review, and an
auditor cannot verify which checks ran.

## Deliberate choices

- **High precision over high recall.** Card numbers need a network prefix, a network length and Luhn;
  SSNs exclude never-issued ranges and placeholders; field matching uses identifier words, not
  substrings. A noisy gate teaches `--no-verify`; the model still covers the long tail.
- **Variables, not just literals.** Most real leaks are a field logged at runtime, so sink calls are
  matched per language, with template-literal and f-string interpolations kept, masked calls
  dropped, and multi-line calls joined.
- **Standalone and dependency-free.** Vendored like `review-gate.ts`. The profile and allowlist are
  read by small strict parsers that refuse what they cannot read, and are tested against a real YAML
  parser on the example profiles.
- **Profile mirror tested.** `FAMILY_CLASSES` is checked against the registry's `data_classes`.
- **Fails closed, never re-leaks.** Any inability to scan blocks; findings mask the value.
- **Allowlist with mandatory reasons.** An exception is recorded, not hidden.
- **Minor bump (0.7.0 → 0.8.0).** New distributed hook; skill and gate spec changes.

## Subtasks

1. `hooks/data-scan.ts` + `hooks/data-scan.test.ts` (Java, Kotlin, TS/Angular, Python, Go, C# cases).
2. Gate stage 6b; `op-data-scan` runs the scanner first; registry notes; `CTL-CCPA-001` gains the hook.
3. README, gate spec, `architecture.md`, `controls/README.md`.
4. Validate on a real codebase before merge.

## Risk register (severity × likelihood → mitigation)

1. **False positives push developers to `--no-verify`** — high × likely without tuning → measured on
   `opuspopuli` (451k lines): 0 blocking findings; email rules tuned from 91 to 12 non-blocking reports;
   regression tests for every false-positive class found.
2. **A real leak the rules miss** — medium × likely → the AI lens and `op-data-scan` still run; the
   scanner is documented as a backstop for patterns, not a replacement.
3. **The scanner itself breaks and passes everything** — high × rare → fails closed; exit codes tested
   end to end (clean 0, leak 1, missing reason 1, bad base 1).
4. **Findings leak the data into CI logs** — high × possible → values masked to the last four; a test
   asserts the raw value never appears in a finding.
5. **Profile mapping drifts from the registry** — medium × possible → mirror test.
6. **Dependency/licence risk** — low × rare → none added.

## Effort

One focused session.

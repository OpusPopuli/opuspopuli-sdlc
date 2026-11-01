# Pre-push enforcement gate (per-repo)

Claude Code plugins ship **skills**, not **git hooks** — a git `pre-push` hook must live in each consuming
repository. This file documents the enforcement gate that pairs with these skills so every repo can install
the same non-bypassable checks.

The gate runs on every `git push` and blocks on failure (`--no-verify` is the only override, and that
override is meant to be logged as an exception in `op-validate`'s release pack).

## Stages

1. **Tests and coverage floor** — the stack's `test` stage; floors live in the build config
2. **Duplication** — the stack's `duplication` stage
3. **Lint** — the stack's `lint` stage
4. **Dependency audit and licence policy** — the stack's `dependency-audit` and `licence-check` stages:
   block on HIGH/CRITICAL CVEs in production dependencies and on licences in `licence.forbidden`
5. **Filesystem scan** — `trivy fs` for vulns + secrets
6. **Secret scan** — `gitleaks detect`

   **6b. Deterministic data scan** — `data-scan.ts` on the diff; block on critical/high
   regulated-data findings (card numbers, card security data, SSNs, Medicare IDs, sensitive fields
   reaching a log, error, telemetry or prompt). It runs before the AI reviews, so catching a pattern
   never depends on a model.
7. **AI code-review gate** — the configured review provider on the diff; block on production-breaking issues or GPL deps
8. **AI security-review gate** — the configured review provider on the diff; block on injection/authz/SSRF/secrets/**PHI-PII exposure**

## The build stages (1–4): stack-neutral

Stages 1–4 run whatever the repo's stack needs, resolved by [`stack.ts`](stack.ts) from
`.sdlc/stack.yaml` (#71). A repo declares a `preset`, or `workspaces` for a polyglot repo, plus
optional per-stage overrides and a licence policy:

```yaml
# .sdlc/stack.yaml — a Gradle backend with an Angular frontend
version: 1
workspaces:
  - path: backend
    preset: java-gradle
  - path: frontend
    preset: node-npm
    commands:
      lint: npx ng lint
licence:
  forbidden: [GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only]
```

<!-- stack-examples -->
| Preset | test | lint | duplication | dependency-audit | licence-check |
|---|---|---|---|---|---|
| `node-pnpm` | `pnpm test` | `pnpm lint` | jscpd 4.3.0 | `pnpm audit --prod --audit-level=high` | license-checker-rseidelsohn 4.4.2, `--failOn` the forbidden list |
| `node-npm` | `npm test` | `npm run lint` | jscpd 4.3.0 | `npm audit --omit=dev --audit-level=high` | as for pnpm |
| `java-maven` | `mvn -B verify` (JaCoCo `check` bound to verify) | `checkstyle:check spotbugs:check` | `pmd:cpd-check` | OWASP `dependency-check-maven:check`, CVSS ≥ 7 | `license-maven-plugin:add-third-party`, forbidden list excluded |
| `java-gradle` | `test jacocoTestCoverageVerification` | `checkstyleMain spotbugsMain` | `cpdCheck` | `dependencyCheckAnalyze` | `checkLicense` (policy in the jk1 plugin's allowed-licences file) |
<!-- /stack-examples -->

Each preset also has a `build` stage, which `op-pr-prep` uses. The Java presets prefer `./mvnw` or
`./gradlew` when the workspace has one, and assume the standard plugins are declared in the build;
thresholds (coverage, CVSS, duplication) live there. Any stage can be overridden per workspace, and
`off` disables one on the record: it prints as skipped, never as passed.

- `node --experimental-strip-types scripts/stack.ts show` prints the resolved plan.
- With no `stack.yaml`, the runner detects a single stack from root build files and says so; several
  stacks, or none, is an error, so a polyglot repo must declare its workspaces.
- **Fails closed:** a config error, an unknown preset or stage, a missing workspace, or a failing
  command blocks.
- Repo-specific behaviour that a preset cannot express, such as treating an unreachable advisory
  endpoint as a warning rather than a finding, stays in a `commands:` override that calls the repo's
  own script.

## The deterministic data scan (6b)

Rules, not a model: the same diff always gives the same findings, nothing in the diff can talk the
scan out of a finding, and an auditor can read exactly which checks ran (#70). It backs up stage 8's
security lens rather than replacing it: rules catch patterns, and the model handles meaning (a real
name in free text, inferred profiles, over-broad API fields).

| What it finds | How |
|---|---|
| Card numbers | 13–19 digits, a real network prefix and length, Luhn-valid, not a published test card |
| Card security data | Track data, and CVV or PIN-block literals: critical anywhere, tests included |
| SSNs, Medicare Beneficiary IDs | Valid formats; never-issued ranges and documentation placeholders excluded |
| Sensitive fields reaching a sink | `log.info(…, patient.getMrn())`, `` console.log(`${user.ssn}`) ``, `raise X(f"{dob}")`: identifier words, not substrings; masked calls skipped |
| Real-looking emails in tests or seed data | Reported, never blocking; `example.com`, `.gov`, role and placeholder addresses excluded |

- **Languages:** sink rules for Java/Kotlin, TypeScript/JavaScript (Angular, React, Node), Python, Go
  and C#, plus a generic fallback. Card and identifier patterns are language-independent.
- **Scoped by the profile:** only the data classes the profile's families declare are scanned. No
  profile means the strict PHI/PII default.
- **Severity by where it lands:** in a log, error, telemetry or prompt call → critical; in code, test
  data or seed data → high; in docs → medium. Critical and high block.
- **Accepted findings** go in `.sdlc/data-scan-allow.yaml`, one entry per path glob (and optionally a
  rule), each with a **reason**. An entry without a reason makes the scan fail.
- **Fails closed:** an unreadable profile or allowlist, or a failed `git diff`, blocks the push.
- **Findings never repeat the value:** card numbers and IDs are masked in output and evidence.
- `--all` scans every tracked file (use it once when adopting); `--evidence <file>` writes JSON for
  `op-validate`.

Measured on the `opuspopuli` monorepo (2,084 files, 451k lines): with every data class on, 0 blocking
findings and 26 non-blocking reports, all of them emails reaching a log call that the repo's
`SecureLogger` masks, which is one allowlist entry.

## The AI review stages (7–8): provider-neutral and fail-closed

Stages 7–8 run through one interface, whichever coding agent the team uses (#58):

1. Collect the diff being pushed (`git diff <base>...HEAD`).
2. Load the compliance profile (`.sdlc/compliance-profile.yaml`, then the deprecated `.claude/` path).
3. Invoke the configured **review provider** (`claude` or `codex`) non-interactively, read-only.
4. Normalize its answer to `{verdict, findings[{severity, file, line, message}]}`.
5. Apply the blocking policy: any `critical` or `high` finding, or a `block` verdict, blocks.
   Repo-specific criteria (API contracts, licence rules, a threat model) go in
   `.sdlc/review/code.md` and `.sdlc/review/security.md`; the runner adds them to that lens. They
   extend the built-in checks and cannot remove them or change the response format.
6. Optionally write the decision as JSON evidence for `op-validate`'s release pack.

**The gate fails closed.** A review that did not complete is a failed gate, not a pass:

| What happened | Result |
|---|---|
| Provider CLI not installed | Blocked |
| Non-zero exit | Blocked, even if the output looks like a pass |
| Timeout (default 300 s) | Blocked |
| Empty output, prose, malformed JSON, missing verdict | Blocked |
| `git diff` against the base fails | Blocked |
| Empty diff | Passes, with no provider call |

A successful invocation is not a successful review. The AI skill is a workflow interface; this gate
is the enforcement, so it never trusts a review that never happened.

The reference implementation is [`review-gate.ts`](review-gate.ts): one file, Node ≥ 22.6, no
dependencies, unit-tested for every row above. Vendor it into the consuming repo (for example
`scripts/review-gate.ts`). Per provider it runs:

- **Claude Code:** `claude --print --output-format text`, prompt on stdin.
- **Codex:** `codex exec --sandbox read-only --ephemeral --output-schema <schema> -o <file> -`, prompt
  on stdin; the schema constrains the final message to the result shape.

## Install (husky example)

[`templates/gate/pre-push`](../templates/gate/pre-push) is the complete gate for any stack. It works
as `.husky/pre-push`, from lefthook's `pre-push`, or as `.git/hooks/pre-push`:

1. Vendor `stack.ts`, `data-scan.ts` and `review-gate.ts` from `hooks/` into the repo's `scripts/`.
2. Add `.sdlc/stack.yaml` (examples in [`controls/examples/`](../controls/examples/): pnpm monorepo,
   Maven service, Gradle + Angular), or rely on detection for a single-stack repo.
3. Copy `templates/gate/pre-push` into place and make it executable.

Every stage fails closed, including a missing Trivy or gitleaks. Set `SDLC_REVIEW_PROVIDER=codex` to
review with Codex, and `SDLC_BASE` to override the base branch. The `opuspopuli` monorepo keeps its own
`.husky/pre-push` with repo-specific handling (for example, a retired npm advisory endpoint is a warning
there rather than a block).

The developer's CLI must be installed and signed in (`claude` or `codex login`). If it is not, the push
is blocked with a message saying so.

**Scope framework-conditional stages to the repo's compliance profile.** The AI security-review
stage's regulated-data lens applies the data classes the repo's profile
(`.sdlc/compliance-profile.yaml`; the deprecated `.claude/compliance-profile.yaml` is still
read) makes active. From a checkout of this plugin, `npm run profile:check -- --repo <consumer-repo>`
resolves and validates it the same way the skills do. When `hipaa` is declared, include the HIPAA lens:

> PHI/PII exposure — real personal/health data (names, DOB, SSN, medical/insurance IDs, addresses) written
> to logs, error messages, telemetry attributes, test fixtures, or seed data without masking, or
> interpolated into a model prompt. Synthetic/faker data is fine; real data is not.

When `us-state-privacy` is declared, apply the CCPA personal-information lens (broader than PII); when
`gdpr` is declared, the EU personal-data lens; when `pci-dss` is declared, the payment card lens (PANs
outside test numbers, unmasked PANs, and any stored sensitive authentication data). With no profile, default to the strict PHI/PII lens
above. The framework-agnostic stages (tests, duplication, lint, dependency/licence/secret scans, AI
code-review) always run. This makes the active data-handling control **enforced at push time**, not
merely available as the `op-data-scan` skill.

## Maintaining this plugin repo

The stages above are for **consuming** repositories. Contributors to *this* repo
(`opuspopuli-sdlc`) — the one that holds the control registry — should additionally run:

```
npm run check   # validate registry + docs match generator + registry↔skills/hooks reconcile + Codex skills in sync + tests
```

before pushing, to catch registry/doc drift locally. The same command is the entire job of the
`internal-drift` GitHub Actions workflow (`.github/workflows/internal-drift.yml`), which gates every
PR. See [`controls/README.md`](../controls/README.md) for the individual checks.

---

**Controls implemented:** `CTL-HIPAA-001` (PHI gate runs on every push, deterministic data scan plus the AI lens), `CTL-CCPA-001` (California personal information scanned at push time), `CTL-SOC2-001` (change management — the enforced gate), `CTL-PCI-001` (cardholder data lens on every push), `CTL-PCI-002` (code and security review before release), `CTL-PCI-003` (dependency, filesystem and secret scans block on high/critical).

Declared in [`controls/registry.yaml`](../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

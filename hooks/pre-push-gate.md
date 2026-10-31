# Pre-push enforcement gate (per-repo)

Claude Code plugins ship **skills**, not **git hooks** — a git `pre-push` hook must live in each consuming
repository. This file documents the enforcement gate that pairs with these skills so every repo can install
the same non-bypassable checks.

The gate runs on every `git push` and blocks on failure (`--no-verify` is the only override, and that
override is meant to be logged as an exception in `op-validate`'s release pack).

## Stages

1. **Coverage floor** — `pnpm test` with per-package coverage thresholds
2. **Duplication** — `pnpm jscpd`
3. **Lint** — `pnpm lint` / SonarJS rules
4. **Dependency audit** — block on HIGH/CRITICAL CVEs in production deps
5. **Filesystem scan** — `trivy fs` for vulns + secrets
6. **Secret scan** — `gitleaks detect`
7. **AI code-review gate** — the configured review provider on the diff; block on production-breaking issues or GPL deps
8. **AI security-review gate** — the configured review provider on the diff; block on injection/authz/SSRF/secrets/**PHI-PII exposure**

## The AI review stages (7–8): provider-neutral and fail-closed

Stages 7–8 run through one interface, whichever coding agent the team uses (#58):

1. Collect the diff being pushed (`git diff <base>...HEAD`).
2. Load the compliance profile (`.sdlc/compliance-profile.yaml`, then the deprecated `.claude/` path).
3. Invoke the configured **review provider** (`claude` or `codex`) non-interactively, read-only.
4. Normalize its answer to `{verdict, findings[{severity, file, line, message}]}`.
5. Apply the blocking policy: any `critical` or `high` finding, or a `block` verdict, blocks.
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

Add these stages to `.husky/pre-push` in the consuming repo. The reference implementation lives in the
`opuspopuli` monorepo's `.husky/pre-push`; copy it and adjust package-manager commands per repo.

For stages 7–8, set the provider once and call the vendored runner for each lens:

```sh
# .husky/pre-push (stages 7-8)
PROVIDER="${SDLC_REVIEW_PROVIDER:-codex}"   # or claude
BASE="origin/$(git remote show origin | sed -n 's/.*HEAD branch: //p')"
node --experimental-strip-types scripts/review-gate.ts --provider "$PROVIDER" --lens code --base "$BASE" || exit 1
node --experimental-strip-types scripts/review-gate.ts --provider "$PROVIDER" --lens security --base "$BASE" || exit 1
```

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
`gdpr` is declared, the EU personal-data lens. With no profile, default to the strict PHI/PII lens
above. The framework-agnostic stages (coverage, duplication, lint, dependency/secret scans, AI
code-review) always run. This makes the active data-handling control **enforced at push time**, not
merely available as the `op-data-scan` skill.

## Maintaining this plugin repo

The stages above are for **consuming** repositories. Contributors to *this* repo
(`opuspopuli-sdlc`) — the one that holds the control registry — should additionally run:

```
npm run check   # validate registry + docs match generator + registry↔skills/hooks reconcile + tests
```

before pushing, to catch registry/doc drift locally. The same command is the entire job of the
`internal-drift` GitHub Actions workflow (`.github/workflows/internal-drift.yml`), which gates every
PR. See [`controls/README.md`](../controls/README.md) for the individual checks.

---

**Controls implemented:** `CTL-HIPAA-001` (PHI gate runs on every push), `CTL-SOC2-001` (change management — the enforced gate).

Declared in [`controls/registry.yaml`](../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

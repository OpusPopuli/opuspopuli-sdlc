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
7. **AI code-review gate** — `claude --print` on the diff; block on production-breaking issues or GPL deps
8. **AI security-review gate** — `claude --print` on the diff; block on injection/authz/SSRF/secrets/**PHI-PII exposure**

## Install (husky example)

Add these stages to `.husky/pre-push` in the consuming repo. The reference implementation lives in the
`opuspopuli` monorepo's `.husky/pre-push`; copy it and adjust package-manager commands per repo.

**Scope framework-conditional stages to the repo's compliance profile.** The AI security-review
stage's regulated-data lens applies the data classes the repo's profile
(`.claude/compliance-profile.yaml`) makes active. When `hipaa` is declared, include the HIPAA lens:

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

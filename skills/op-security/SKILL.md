---
name: op-security
description: Run a local security scan (dependency CVEs, filesystem, secrets) and triage findings. Use before PR prep or release.
argument-hint: (none — scans the current repository)
---

Run a local security scan on the current repository.

Perform the following scans in order:

1. **Dependency CVEs** — `pnpm audit --prod` (all severities). For non-pnpm repos, use the equivalent (`npm audit`, etc.)
2. **Filesystem scan** — `trivy fs . --scanners vuln,secret --severity HIGH,CRITICAL --ignore-unfixed` (skip LOW/MEDIUM noise)
3. **Secret scan** — `gitleaks detect --source . --no-banner`

After all scans complete:

4. Summarize findings grouped by severity: **critical | high | medium | low**
5. For each CRITICAL or HIGH finding: identify the affected package/file, explain the impact, and give a specific fix (version bump or override)
6. Flag any GPL-licensed dependency additions that violate an AGPL-3.0 dual-commercial license structure
7. If all scans are clean, confirm it is safe to proceed

Do not suggest proceeding with PR prep until all CRITICAL and HIGH findings are resolved.

## Context (pnpm monorepo)

- Primary package manager: pnpm (workspace monorepo)
- Fix transitive CVEs via `pnpm.overrides` in the root `package.json`, not by pinning in child packages
- Fix direct dep CVEs by bumping the version in the relevant `package.json`
- After adding overrides: run `pnpm install` then re-run `pnpm audit` to verify

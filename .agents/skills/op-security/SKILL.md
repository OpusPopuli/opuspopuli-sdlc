---
name: op-security
description: Run a local security scan (dependency CVEs, filesystem, secrets) and triage findings. Use before PR prep or release.
---

<!-- GENERATED from skills/op-security/SKILL.md (opuspopuli-sdlc v0.8.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

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

**When the profile declares `pci-dss`**, also confirm the component inventory exists for this commit
(the committed lockfile, or an SBOM if the repo produces one) and name it in the summary, so a later
advisory can be traced to what it affects.

## Context (pnpm monorepo)

- Primary package manager: pnpm (workspace monorepo)
- Fix transitive CVEs via `pnpm.overrides` in the root `package.json`, not by pinning in child packages
- Fix direct dep CVEs by bumping the version in the relevant `package.json`
- After adding overrides: run `pnpm install` then re-run `pnpm audit` to verify

---

**Controls implemented:** `CTL-PCI-003` (vulnerabilities identified and patched; bespoke and third-party components inventoried).

Declared in [`controls/registry.yaml`](../../../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

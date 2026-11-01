---
name: op-security
description: Run a local security scan (dependency CVEs, filesystem, secrets) and triage findings. Use before PR prep or release.
argument-hint: (none — scans the current repository)
---

Run a local security scan on the current repository.

Perform the following scans in order:

1. **Dependency CVEs** — the stack's `dependency-audit` stage (`node --experimental-strip-types scripts/stack.ts
   run dependency-audit`; `show` prints the command for each workspace). Report all severities, not just
   the ones the stage blocks on
2. **Filesystem scan** — `trivy fs . --scanners vuln,secret --severity HIGH,CRITICAL --ignore-unfixed` (skip LOW/MEDIUM noise)
3. **Secret scan** — `gitleaks detect --source . --no-banner`

After all scans complete:

4. Summarize findings grouped by severity: **critical | high | medium | low**
5. For each CRITICAL or HIGH finding: identify the affected package/file, explain the impact, and give a specific fix (version bump or override)
6. **Licences** — run the stack's `licence-check` stage, and flag any new dependency whose licence is in
   `licence.forbidden` in `.sdlc/stack.yaml` (for example GPL dependencies in an AGPL dual-licensed
   repo). With no `licence.forbidden`, list new dependencies' licences and say no policy is declared
7. If all scans are clean, confirm it is safe to proceed

Do not suggest proceeding with PR prep until all CRITICAL and HIGH findings are resolved.

**When the profile declares `pci-dss`**, also confirm the component inventory exists for this commit
(the committed lockfile, or an SBOM if the repo produces one) and name it in the summary, so a later
advisory can be traced to what it affects.

## Remediation, by stack

Fix a direct dependency by bumping it where it is declared. Fix a transitive one at the workspace root,
not by pinning it in a child module, then re-run the `dependency-audit` stage to confirm:

<!-- stack-examples -->
- **node-pnpm:** `pnpm.overrides` in the root `package.json`, then `pnpm install`
- **node-npm:** `overrides` in `package.json`, then `npm install`
- **java-maven:** a version in `<dependencyManagement>` (the parent pom for multi-module builds)
- **java-gradle:** a `constraints { }` block, or `resolutionStrategy.force`, in the root build
<!-- /stack-examples -->

---

**Controls implemented:** `CTL-PCI-003` (vulnerabilities identified and patched; bespoke and third-party components inventoried).

Declared in [`controls/registry.yaml`](../../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

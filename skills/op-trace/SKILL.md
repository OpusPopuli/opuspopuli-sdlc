---
name: op-trace
description: Build or update the Requirements Traceability Matrix for an issue — requirement → plan → code → test → review → release. Use to prove traceability for an issue or before an audit.
argument-hint: <issue-number>
---

Build (or update) the Requirements Traceability Matrix (RTM) for GitHub issue #$ARGUMENTS.

Traceability is the backbone control shared by 21 CFR Part 11, ISO 62304, and SOC 2: every requirement
must be traceable forward to the code and tests that satisfy it, and backward from a release to its origin.

Assemble the chain from real evidence (GitHub MCP + git), do not invent links:

1. **Requirement** — the issue: number, title, acceptance criteria, data classification (from its `/op-issue-plan`)
2. **Plan** — the persisted `docs/plans/<issue>-*.md`, if present
3. **Code** — commits referencing the issue (`#$ARGUMENTS`), with files/services touched
4. **Tests** — the test files/cases that cover each acceptance criterion (map criterion → test, and flag
   any acceptance criterion with NO covering test — that is a traceability gap, report it)
5. **Review** — the PR review sign-off(s) and author/reviewer identities (separation-of-duties status)
6. **Release** — the release tag/version this shipped in, if released

Output a matrix table (one row per acceptance criterion) with columns:
`Requirement | Plan §  | Commit(s) | Test(s) | Review | Release | Status`

- Status = `traced` / `gap: no test` / `gap: not reviewed` / `pending release`
- Call out every gap explicitly at the end — an RTM with silent gaps is worse than none.

Persist to `docs/compliance/traceability/<issue>-rtm.md` and show me before writing.

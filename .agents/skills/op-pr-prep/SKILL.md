---
name: op-pr-prep
description: Prepare the current branch for a pull request — checks, PR description, reviewers, compliance artifacts. Use right before opening a PR.
---

<!-- GENERATED from skills/op-pr-prep/SKILL.md (opuspopuli-sdlc v0.5.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

Prepare the current branch for a pull request.

1. Run: pnpm lint && pnpm test && pnpm build
2. Review the full diff against the base branch — flag anything unexpected
3. Check for: console.log, debug flags, TODO comments, hardcoded secrets, skipped tests
4. Run `$op-data-scan` — no critical/high regulated-data exposure may remain
5. Verify GraphQL schema changes don't break federation (check gateway compatibility)
6. Confirm no new dependencies conflict with AGPL-3.0 license
7. Draft a PR description:
   - Title (conventional commits format)
   - What changed and why
   - How to test
   - Screenshots if frontend changes
   - Linked issue(s)
   - Data classification (PHI/PII/public)
8. Suggest reviewers based on changed files (and note separation-of-duties — a reviewer other than the author)
9. Offer to generate `$op-trace` (RTM) and `$op-change-record` for the change

Output the PR description ready to paste.

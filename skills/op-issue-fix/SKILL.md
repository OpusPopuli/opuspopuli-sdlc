---
name: op-issue-fix
description: Fix the bug described in a GitHub issue with a minimal, well-tested change. Use for scoped bug fixes.
argument-hint: <issue-number>
---

Fix the bug described in GitHub issue #$ARGUMENTS.

1. Read the issue and confirm understanding of the root cause
2. Implement the minimal fix — avoid scope creep
3. Follow existing patterns in the affected service
4. Write or update tests that would have caught this bug
5. Run: pnpm lint && pnpm test in the affected package
6. Verify no unintended changes to GraphQL schema or Supabase migrations
7. Run `/op-verify` to drive the fixed path end-to-end and confirm the bug is actually gone
8. Stage changes and show a diff summary for my review
9. Prepare a commit message: fix(scope): short description (#issue-num)

Do not commit until I approve the diff.

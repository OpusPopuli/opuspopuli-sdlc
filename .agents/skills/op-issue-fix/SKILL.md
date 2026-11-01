---
name: op-issue-fix
description: Fix the bug described in a GitHub issue with a minimal, well-tested change. Use for scoped bug fixes.
---

<!-- GENERATED from skills/op-issue-fix/SKILL.md (opuspopuli-sdlc v0.10.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<issue-number>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Fix the bug described in GitHub issue #{input}.

1. Read the issue and confirm understanding of the root cause
2. Implement the minimal fix — avoid scope creep
3. Follow existing patterns in the affected service
4. Write or update tests that would have caught this bug
5. Run the stack's `lint` and `test` stages for the affected workspace
   (`node --experimental-strip-types scripts/stack.ts run lint`, then `test`)
6. Verify no unintended changes to API contracts (GraphQL schema, OpenAPI spec, gRPC protos) or
   database migrations
7. Run `$op-verify` to drive the fixed path end-to-end and confirm the bug is actually gone
8. Stage changes and show a diff summary for my review
9. Prepare a commit message: fix(scope): short description (#issue-num)

Do not commit until I approve the diff.

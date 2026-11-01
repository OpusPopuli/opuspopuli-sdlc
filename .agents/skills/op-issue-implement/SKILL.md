---
name: op-issue-implement
description: Implement a feature from an approved plan, subtask by subtask, with review gates. Use to build out a planned feature.
---

<!-- GENERATED from skills/op-issue-implement/SKILL.md (opuspopuli-sdlc v0.9.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<issue-number>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Implement the feature described in GitHub issue #{input}.

Prerequisite: an approved `$op-issue-plan` must exist (persisted in `docs/plans/`). If not, run `$op-issue-plan` first.

1. Work through subtasks in the approved plan order
2. After each subtask: run lint + tests, show me a diff, wait for approval before continuing
3. Keep commits atomic — one logical change per commit
4. Commit message format: feat(scope): description (#issue-num)
5. If you encounter something unexpected that changes the plan, stop and flag it (and update the persisted plan)
6. On completion: run the full test suite, then `$op-verify` to drive the feature end-to-end and confirm all checks pass
7. Generate a `$op-change-record` for the change and update the issue with a summary comment via GitHub MCP

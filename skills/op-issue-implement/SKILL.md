---
name: op-issue-implement
description: Implement a feature from an approved plan, subtask by subtask, with review gates. Use to build out a planned feature.
argument-hint: <issue-number>
---

Implement the feature described in GitHub issue #$ARGUMENTS.

Prerequisite: an approved `/op-issue-plan` must exist (persisted in `docs/plans/`). If not, run `/op-issue-plan` first.

1. Work through subtasks in the approved plan order
2. After each subtask: run lint + tests, show me a diff, wait for approval before continuing
3. Keep commits atomic — one logical change per commit
4. Commit message format: feat(scope): description (#issue-num)
5. If you encounter something unexpected that changes the plan, stop and flag it (and update the persisted plan)
6. On completion: run the full test suite, then `/op-verify` to drive the feature end-to-end and confirm all checks pass
7. Generate a `/op-change-record` for the change and update the issue with a summary comment via GitHub MCP

---
name: op-ci
description: Check GitHub Actions status for the current branch, diagnose failures, and classify them. Use to see if CI is green before merging.
argument-hint: (none — uses the current branch)
---

Check GitHub Actions status for the current branch using the GitHub MCP.

1. Show all workflow runs — status, duration, trigger
2. For any failures: fetch the failed job logs and identify the root cause
3. Classify failure: flaky test | real regression | infra/timeout | config error
4. Suggest a specific fix for each failure
5. If all passing: confirm it's safe to merge

If a fix is needed, ask whether I want you to implement it now.

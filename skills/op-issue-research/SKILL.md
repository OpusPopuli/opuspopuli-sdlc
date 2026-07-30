---
name: op-issue-research
description: Deeply research a GitHub issue before implementation — codebase, history, hypotheses. Use to understand an issue before planning.
argument-hint: <issue-number>
---

Research GitHub issue #$ARGUMENTS deeply before any implementation begins.

1. Read the full issue thread including all comments
2. Search the codebase for files and functions most likely involved
3. Check git log for recent changes to those files
4. Look for related closed issues or PRs that touched the same area
5. Identify which microservice(s) are affected
6. If it's a bug: form 2-3 hypotheses for root cause, ranked by likelihood
7. If it's a feature: identify integration points across the federation gateway, database schema, and frontend

Summarize your findings and suggest the safest approach before I approve any changes.

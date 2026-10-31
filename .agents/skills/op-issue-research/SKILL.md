---
name: op-issue-research
description: Deeply research a GitHub issue before implementation — codebase, history, hypotheses. Use to understand an issue before planning.
---

<!-- GENERATED from skills/op-issue-research/SKILL.md (opuspopuli-sdlc v0.6.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<issue-number>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Research GitHub issue #{input} deeply before any implementation begins.

1. Read the full issue thread including all comments
2. Search the codebase for files and functions most likely involved
3. Check git log for recent changes to those files
4. Look for related closed issues or PRs that touched the same area
5. Identify which microservice(s) are affected
6. If it's a bug: form 2-3 hypotheses for root cause, ranked by likelihood
7. If it's a feature: identify integration points across the federation gateway, database schema, and frontend

Summarize your findings and suggest the safest approach before I approve any changes.

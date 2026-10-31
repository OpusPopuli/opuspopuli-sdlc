---
name: op-issue-triage
description: Triage all open unlabeled issues — classify, size, prioritize against the current milestone. Use to groom the backlog.
---

<!-- GENERATED from skills/op-issue-triage/SKILL.md (opuspopuli-sdlc v0.6.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

Fetch all open, unlabeled issues from this repository using the GitHub MCP.

For each issue:
1. Classify: bug | feature | chore | question
2. Estimate effort: S (< 2h) | M (half day) | L (1-2 days) | XL (needs breakdown)
3. Assess impact: critical | high | medium | low
4. Identify affected service: gateway | frontend | auth | civic-data | infra | cross-cutting
5. Suggest priority order given the current milestone / release target

Output a ranked table, then ask which issues I want to update.

---
name: op-issue-plan
description: Create a detailed, persisted implementation plan for a GitHub issue, with a risk register and data classification. Use when planning work on an issue before implementation.
argument-hint: <issue-number>
---

Create a detailed implementation plan for GitHub issue #$ARGUMENTS.

1. Read the issue and any linked research
2. Break the work into ordered subtasks — each subtask should be completable in one focused session
3. For each subtask specify:
   - Which files to create or modify
   - Which service/package it lives in
   - Any schema migrations required
   - Any GraphQL schema or resolver changes (flag federation impact)
   - Test coverage needed
4. **Data classification** (scoped to the repo's compliance profile): state whether this change
   touches any regulated data class the profile (`.claude/compliance-profile.yaml`) makes active —
   PHI/PII under `hipaa`, CCPA personal information under `us-state-privacy`, EU personal data under
   `gdpr`; with no profile, treat PHI/PII as the strict default. If yes, note the data flow and where
   it is stored, logged, or sent to a model. Flag any path that would put regulated data into logs,
   prompts, fixtures, or a third-party service. Framework-agnostic planning (this plan-of-record, its
   risk register) is produced regardless of profile.
5. **Risk register**: for each material risk, record it as `severity × likelihood → mitigation`
   (severity: low/medium/high/critical; likelihood: rare/possible/likely). Cover breaking changes,
   migration safety, AGPL-3.0 dependency constraints, and regulated-data exposure.
6. Estimate total effort
7. Suggest a branch name (conventional: type/issue-num-short-description)

Present the plan for my approval before touching any files.

**On approval** — persist the plan so it becomes a traceable, reviewable artifact (do NOT skip this):
- Write the approved plan to `docs/plans/<issue-num>-<short-slug>.md`
- Include a header block: issue number/link, date, author, data classification, and the risk register
- This file is the traceability anchor that `/op-trace`, `/op-change-record`, and `/op-validate` link back to
- Stage it in the same commit series as the implementation so the plan-of-record travels with the code

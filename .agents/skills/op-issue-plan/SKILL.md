---
name: op-issue-plan
description: Create a detailed, persisted implementation plan for a GitHub issue, with a risk register and data classification. Use when planning work on an issue before implementation.
---

<!-- GENERATED from skills/op-issue-plan/SKILL.md (opuspopuli-sdlc v0.6.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<issue-number>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Create a detailed implementation plan for GitHub issue #{input}.

1. Read the issue and any linked research
2. Break the work into ordered subtasks — each subtask should be completable in one focused session
3. For each subtask specify:
   - Which files to create or modify
   - Which service/package it lives in
   - Any schema migrations required
   - Any GraphQL schema or resolver changes (flag federation impact)
   - Test coverage needed
4. **Data classification** (scoped to the repo's compliance profile): state whether this change
   touches any regulated data class the profile (`.sdlc/compliance-profile.yaml`, or the deprecated `.claude/` copy) makes active —
   PHI/PII under `hipaa`, CCPA personal information under `us-state-privacy`, EU personal data under
   `gdpr`; with no profile, treat PHI/PII as the strict default. If yes, note the data flow and where
   it is stored, logged, or sent to a model. When `hipaa` is declared, also state how that PHI is
   encrypted at rest and in transit, and name every third party that will newly receive it, with
   whether a business associate agreement covers it ("unknown" is an open question, not a yes).
   Flag any path that would put regulated data into logs,
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
- This file is the traceability anchor that `$op-trace`, `$op-change-record`, and `$op-validate` link back to
- Stage it in the same commit series as the implementation so the plan-of-record travels with the code

---

**Controls implemented:** `CTL-SOC2-001` (change management — the plan of record), `CTL-ISO-001` (risk management per change — the risk register in every plan), `CTL-CCPA-002` (consumer rights — data-handling planning for changes touching personal information), `CTL-HIPAA-005` (encryption safe harbor — the plan records how PHI is stored and transmitted), `CTL-HIPAA-006` (business associates — new third-party PHI recipients and their BAA status).

Declared in [`controls/registry.yaml`](../../../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

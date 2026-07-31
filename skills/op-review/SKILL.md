---
name: op-review
description: Multi-lens code review of the current diff, with separation-of-duties and PHI-exposure checks. Use before opening or merging a PR.
argument-hint: (none — reviews staged changes or diff against the base branch)
---

Review the current staged changes or diff against the base branch (`develop`, falling back to `main`).

Run the review as **independent lenses** and merge the results — do not let one concern mask another.
Where useful, spawn parallel subagents (one per lens) so each looks with fresh eyes, then reconcile:

- **Correctness** — does it do what the issue requires? Null/undefined on hot paths, empty arrays, race conditions
- **Security** — injection, auth/HMAC/CSRF bypass, SSRF, over-exposed data in GraphQL resolvers
- **Regulated-data handling** — does any regulated data reach logs, error messages, prompts, fixtures, seed
  data, or an over-broad GraphQL field? Is field-level access appropriately restricted? Scope this lens to
  the data classes the repo's compliance profile makes active (`.claude/compliance-profile.yaml`) — PHI/PII
  when `hipaa` is declared, CCPA personal information when `us-state-privacy` is declared, and so on. With
  no profile, default to the strict PHI/PII lens. (See `/op-data-scan`.)
- **Performance** — N+1 queries, missing indexes, large payloads
- **TypeScript strictness** — no implicit `any`, proper typing
- **Test coverage** — are the important paths (including the regulated-data paths) tested?
- **Consistency** — matches existing patterns in this codebase

**Separation of duties (SOC 2 / Part 11):** determine the commit author(s) via `git log`. If the person
running this review is also the sole author, say so plainly and record it as a *self-review* — for a
change control record it must be countersigned by a second person before it counts as an independent review.

Output a structured review: **blockers | suggestions | nitpicks**.
Blockers must be fixed before merge. Suggestions are recommended. Nitpicks are optional.
Note the author/reviewer identities at the top so `/op-change-record` can capture the sign-off.

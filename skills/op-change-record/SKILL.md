---
name: op-change-record
description: Generate a signed change-control record for the current PR — what/why/risk/data/review/rollback (SOC 2 CC8.1, 21 CFR Part 11). Use when a change is ready to merge.
argument-hint: <issue-number or PR number>
---

Generate a change-control record for the change tied to #$ARGUMENTS. This is the auditable unit SOC 2
change management (CC8.1) and 21 CFR Part 11 both expect: a signed, dated record that a change was
planned, reviewed by someone other than the author, tested, and reversible.

Fill every field from real evidence (git, GitHub MCP, the persisted plan) — mark `UNKNOWN` rather than guessing:

- **Change ID / title** and linked issue(s)
- **Author(s)** and **Reviewer(s)** (from git + PR reviews) — and the **separation-of-duties status**
  (independent review vs. self-review needing countersignature)
- **What changed and why** (one paragraph, from the plan + diff)
- **Data classification** — PHI / PII / public; if regulated, the `/op-data-scan` result reference
- **Risk register** — carried from `docs/plans/<issue>-*.md` (severity × likelihood → mitigation)
- **Verification evidence** — test + coverage result, and the `/op-verify` behavioral result
- **Security evidence** — `/op-security` result and pre-push gate outcome
- **Rollback plan** — how to revert safely (migration reversibility, feature flag, revert commit)
- **Approval** — approver identity, date, and the meaning of the approval ("approved for release to production")

Approvals are electronic signatures: capture who, when, and what they attested — never fabricate one.
Present the record for my approval, then persist to `docs/compliance/changes/<issue>-change-record.md`.
`/op-validate` collects these into the release evidence pack.

---
name: op-hotfix
description: Production hotfix — minimal blast radius, with an incident record and a follow-up backlog loop. Use for urgent production fixes.
---

<!-- GENERATED from skills/op-hotfix/SKILL.md (opuspopuli-sdlc v0.7.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<symptom description>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Production hotfix for: {input}

This is a priority path — minimize blast radius, maximize speed.

1. Identify the likely cause from the symptom description
2. Find the minimal code change that resolves it — no refactoring, no extras
3. Check if a feature flag can mitigate while a proper fix is prepared
4. Write a regression test before fixing
5. Run lint + test on affected packages only
6. Prepare a hotfix branch off main: hotfix/short-description
7. Draft a commit message and PR description that explains the incident
8. **Stop and show me the diff before committing.** This is the highest-risk path in the lifecycle —
   a change going to production under time pressure with the normal review compressed. Present the
   minimal diff, the regression test, and the blast radius, and wait for my go-ahead. Urgency is the
   reason to show the diff, not the reason to skip showing it.

   *Emergency deviation:* if I tell you to proceed without review, do it — and **record the deviation**
   (who authorized it, when, why) in the incident summary and the change record, so it lands in the
   next `$op-validate` exceptions list. An unreviewed production change is a legitimate emergency
   action and an illegitimate secret.
9. **Data-exposure check**: if the incident touched PHI/PII (leaked, mis-routed, over-exposed in a
   response or log), say so explicitly — it may be a reportable event, not just a bug. Flag it for me.

   **When the profile declares `hipaa` and PHI was involved**, an impermissible use or disclosure is
   *presumed* a breach under HITECH, and notice to individuals is due within 60 days of discovery. Do not
   decide whether it is a breach — that is a privacy/legal call. Record the facts the decision needs, now,
   in the incident summary and the change record, under a **Breach assessment input** heading:
   - **Discovered:** the date and time anyone on the team first knew (the 60-day clock starts here,
     not when the fix ships)
   - **PHI involved:** which identifiers and record types, and roughly how many individuals
   - **Secured?** whether the exposed PHI was encrypted to the HHS standard (if so, it may not be
     "unsecured PHI"); say "unknown" rather than guess
   - **The four factors**, from what engineering can see: (i) nature and extent of the PHI and
     likelihood of re-identification, (ii) who received or used it, (iii) whether it was actually
     acquired or viewed (logs, access records), (iv) what was done to mitigate
   - **Handed to:** who received this for the breach determination, and when

   Mark it unresolved until a named person records the determination. A missing assessment is an
   exception in the next `$op-validate`.

**After merge — close the loop (do NOT skip; this is the production→backlog feedback path):**

10. Draft the incident summary comment to post on the related issue (timeline, cause, fix, blast radius)
11. **File follow-up issues via the GitHub MCP** and show them to me before creating:
    - The *proper* fix if this was a mitigation/band-aid (label: `tech-debt`, link the incident)
    - Any missing test/observability that would have caught it earlier
    - A `postmortem` issue if the data-exposure check flagged regulated data
12. Add a one-line entry to the incident log the next `$op-validate` will pick up as release evidence

Speed matters but correctness matters more — flag me if you're uncertain.

---

**Controls implemented:** `CTL-CCPA-003` (reasonable security and breach liability — a breach becomes an incident record with the follow-up backlog loop), `CTL-HIPAA-004` (HITECH breach readiness — the incident record carries the four-factor breach-assessment input and the discovery date).

Declared in [`controls/registry.yaml`](../../../controls/registry.yaml) under each control's
`implemented_by`. `npm run reconcile` fails if this list and the registry disagree in either
direction — the registry cannot claim an artifact implements a control the artifact never
mentions (#48).

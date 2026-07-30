---
name: op-hotfix
description: Production hotfix — minimal blast radius, with an incident record and a follow-up backlog loop. Use for urgent production fixes.
argument-hint: <symptom description>
---

Production hotfix for: $ARGUMENTS

This is a priority path — minimize blast radius, maximize speed.

1. Identify the likely cause from the symptom description
2. Find the minimal code change that resolves it — no refactoring, no extras
3. Check if a feature flag can mitigate while a proper fix is prepared
4. Write a regression test before fixing
5. Run lint + test on affected packages only
6. Prepare a hotfix branch off main: hotfix/short-description
7. Draft a commit message and PR description that explains the incident
8. **Data-exposure check**: if the incident touched PHI/PII (leaked, mis-routed, over-exposed in a
   response or log), say so explicitly — it may be a reportable event, not just a bug. Flag it for me.

**After merge — close the loop (do NOT skip; this is the production→backlog feedback path):**

9. Draft the incident summary comment to post on the related issue (timeline, cause, fix, blast radius)
10. **File follow-up issues via the GitHub MCP** and show them to me before creating:
    - The *proper* fix if this was a mitigation/band-aid (label: `tech-debt`, link the incident)
    - Any missing test/observability that would have caught it earlier
    - A `postmortem` issue if the data-exposure check flagged regulated data
11. Add a one-line entry to the incident log the next `/op-validate` will pick up as release evidence

Speed matters but correctness matters more — flag me if you're uncertain.

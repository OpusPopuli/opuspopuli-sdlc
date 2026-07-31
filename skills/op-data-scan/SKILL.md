---
name: op-data-scan
description: Scan the repo or diff for regulated data (PHI/PII, and other categories per the repo's compliance profile) leaking into code, logs, fixtures, prompts, or seed data. Use before PR prep and release on any change touching personal data.
argument-hint: (none — scans the current diff by default; pass "full" to scan the whole tree)
---

Run a regulated-data exposure scan. Default scope is the current diff against the base branch; if
`$ARGUMENTS` is `full`, scan the whole working tree.

## Scope the scan to the repo's compliance profile

First read the consuming repo's compliance profile (`.claude/compliance-profile.yaml`; see
`controls/README.md` in the `opuspopuli-sdlc` plugin). The **active data classes** are the union of
`data_classes` across the profile's declared framework families (as defined in the control
registry's `frameworks:` map). Apply only the sections below whose data class is active:

- **No profile declared** → default to the `phi-pii` section (the safe, strict default) and note in
  the output that no compliance profile was found.
- **`phi-pii` active** (family `hipaa`) → run the PHI/PII section below, unchanged.
- **`ca-personal-information` active** (family `us-state-privacy`) → run the CCPA section
  *(detection categories added by #8; until then, apply the PHI/PII section as the nearest
  superset and note the gap)*.
- **`eu-personal-data` active** (family `gdpr`) → run the GDPR section *(added by #7)*.

Only the active categories are in scope. A repo whose profile does not declare `hipaa` is not
failed for HIPAA-specific PHI framing — but note that `phi-pii` and `ca-personal-information`
overlap heavily (names, addresses, identifiers), so most personal-data findings apply under either.

## PHI/PII (data class `phi-pii`)

**What counts as regulated data here:** names, addresses, emails, phone numbers, dates of birth,
government IDs (SSN), medical record numbers, insurance IDs, geolocation finer than state, IP addresses
tied to an individual, and any free-text that could carry the above.

Scan for these exposure sinks specifically:

1. **Logs & errors** — real PHI/PII passed to `console.*`, logger calls, thrown error messages, or
   OpenTelemetry attributes without masking. (The audit logger masks PII by design — flag anything that
   bypasses it.)
2. **Fixtures & seed data** — real (not synthetic) personal data committed under `__tests__`, fixtures,
   or `supabase/seed*`. Test data must be synthetic/faker-generated.
3. **Prompts** — PHI/PII interpolated into any text sent to a model. Note: self-hosted Ollama + the
   private prompt-service keep this in-house, but still flag it — minimum-necessary applies internally too.
4. **GraphQL over-exposure** — resolvers or fields that return more personal data than the operation needs.
5. **Hardcoded examples** — realistic-looking personal records pasted into code comments or docs.

## CCPA / CPRA personal information (data class `ca-personal-information`)

*Detection categories are contributed by the US state privacy pack (#8). CCPA "personal
information" is broader than classic PII — it includes household-level data, unique identifiers,
commercial/browsing history, geolocation, and inferences drawn to build a profile. Until #8 lands,
apply the PHI/PII section above as the nearest superset and note that CCPA-specific categories
(household data, inferences) are not yet itemized.*

## GDPR personal data (data class `eu-personal-data`)

*Detection categories are contributed by the GDPR pack (#7), including Article 9 special
categories. Not yet itemized.*

## Report

6. Group findings by sink and severity (critical = real regulated data to a third party or unmasked
   log; high = real personal data in repo; medium = realistic-looking sample data; low = advisory).
7. For each finding give the file/line, which data class and why it is an exposure, and the specific
   fix (mask, remove, replace with synthetic data, restrict the field).
8. If clean, state that no regulated-data exposure sinks were found in scope, and which data classes
   were in scope (from the profile).

Do not approve PR prep or release while any critical or high finding is unresolved.
This scan is the evidence `/op-validate` cites for the data-handling controls of the active
frameworks (e.g. the HIPAA data-handling control when `hipaa` is declared).

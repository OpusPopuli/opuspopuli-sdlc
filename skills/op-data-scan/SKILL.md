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
3. **Prompts** — PHI/PII interpolated into any text the consuming app sends to a model at runtime.
   If the app uses self-hosted inference (as Opus Populi does) this stays in its trust boundary, but
   still flag it — minimum-necessary applies internally too. (This is about the *app's* runtime AI,
   not the SDLC's own tooling.)
4. **GraphQL over-exposure** — resolvers or fields that return more personal data than the operation needs.
5. **Hardcoded examples** — realistic-looking personal records pasted into code comments or docs.

## CCPA / CPRA personal information (data class `ca-personal-information`)

CCPA "personal information" (Cal. Civ. Code § 1798.140(v)) is **broader than classic PII** — it is
information that identifies or could reasonably be linked, directly or indirectly, with a particular
consumer *or household*. Everything in the PHI/PII section above still applies; additionally scan for
these CCPA-specific categories:

- **Household data** — data tied to a household rather than a named individual (a household is a
  protected subject under CCPA, unlike most PII regimes).
- **Unique & online identifiers** — cookie IDs, device IDs, advertising IDs, IP addresses,
  account/customer IDs, and other pseudonymous identifiers that persist across sessions.
- **Commercial information** — records of products/services purchased, obtained, or considered;
  purchasing or consuming histories.
- **Internet/network activity** — browsing history, search history, and interaction data with a
  site, app, or ad.
- **Geolocation data** — location derived from IP, GPS, or device signals.
- **Inferences & profiles** — inferences drawn from any of the above to create a profile reflecting
  preferences, characteristics, behavior, or aptitudes. Flag derived/scored fields, not just raw
  captured data — this is the category teams most often miss.

**Sensitive personal information** (§ 1798.140(ae)) is a heightened subset — SSN/driver's
license/passport numbers, financial account + access credentials, precise geolocation, race or
ethnic origin, religious beliefs, union membership, contents of mail/email/texts, genetic data,
biometric identifiers, and health/sex-life/sexual-orientation data. Treat exposure of these as
critical/high.

The exposure sinks are the same as the PHI/PII section (logs & errors, fixtures & seed data,
prompts, GraphQL over-exposure, hardcoded examples). Note that most name/address/email/identifier
findings apply under both `phi-pii` and `ca-personal-information`; the CCPA-distinct additions are
household data, pseudonymous identifiers, browsing/commercial history, and inferences.

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

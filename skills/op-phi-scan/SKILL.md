---
name: op-phi-scan
description: Scan the repo or diff for PHI/PII leaking into code, logs, fixtures, prompts, or seed data (HIPAA safeguard). Use before PR prep and release on any change touching personal data.
argument-hint: (none — scans the current diff by default; pass "full" to scan the whole tree)
---

Run a PHI/PII exposure scan. Default scope is the current diff against the base branch; if `$ARGUMENTS`
is `full`, scan the whole working tree.

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

Then:

6. Group findings by sink and severity (critical = real PHI to a third party or unmasked log; high =
   real PII in repo; medium = realistic-looking sample data; low = advisory).
7. For each finding give the file/line, why it is a HIPAA exposure, and the specific fix (mask, remove,
   replace with synthetic data, restrict the field).
8. If clean, state that no PHI/PII exposure sinks were found in scope.

Do not approve PR prep or release while any critical or high PHI/PII finding is unresolved.
This scan is the evidence `/op-validate` cites for the HIPAA data-handling control.

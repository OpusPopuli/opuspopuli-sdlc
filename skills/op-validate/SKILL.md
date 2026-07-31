---
name: op-validate
description: Assemble the release validation / qualification evidence pack for an auditor (HIPAA-first, CSV/CSA-style). Use at release time to produce the audit binder.
argument-hint: <release version, e.g. v1.4.0>
---

Assemble the validation evidence pack for release $ARGUMENTS — the "binder" an auditor asks for. This is
the Part 11 / GxP computer-software-assurance idea applied lightly: show that everything in this release
was planned, reviewed, tested, verified, and screened for regulated-data exposure, with evidence.

**Scope to the repo's compliance profile.** Read `.claude/compliance-profile.yaml` (see
`controls/README.md` in the `opuspopuli-sdlc` plugin) and record which framework families are active.
The pack's framework-specific sections (HIPAA, Part 11, GxP, privacy) are included only for active
families; sections for inactive families are omitted with a one-line "not in scope for this repo's
profile" note rather than left blank. Framework-agnostic evidence (plans, change records,
traceability, test results) is always included. **If no profile is declared, state that plainly in
the header** and include only the framework-agnostic evidence.

Collect, for every change since the previous release tag (use `/op-release`'s PR list as the index):

1. **Scope** — list of PRs/issues in this release, each with its data classification
2. **Traceability** — link each issue's RTM (`docs/compliance/traceability/*-rtm.md`); flag any change
   with no RTM or an open traceability gap
3. **Change control** — link each `docs/compliance/changes/*-change-record.md`; flag any missing record,
   or any record whose review was a self-review without countersignature (separation-of-duties exception)
4. **Verification & validation** — aggregate test results, coverage vs. the enforced floors, and the
   `/op-verify` behavioral outcomes
5. **Security** — the `/op-security` results (CVE/Trivy/gitleaks) and the pre-push gate outcomes
6. **Regulated-data handling** — the `/op-data-scan` results across the release, for the data classes
   the repo's compliance profile makes active; explicitly state that no critical/high exposure
   findings remain open. Note the data-residency posture (self-hosted Ollama + private prompt-service
   — no regulated data or code sent to a third-party model vendor). When `hipaa` is active this is the
   HIPAA data-handling control's evidence.
7. **Risk** — the consolidated risk register across the release and the status of each mitigation
8. **Exceptions** — every gap, waiver, or `--no-verify` override in this release, with justification.
   An honest exceptions list is mandatory; an evidence pack that hides gaps is a finding, not a pass.

Output the pack as `docs/compliance/releases/<version>-validation.md` and show me before writing.

**Honesty guardrail:** this pack is *audit-ready scaffolding and evidence* — it supports HIPAA/SOC 2/
Part 11 controls. It does not by itself make the organization compliant; that requires policies,
training, risk assessments, BAAs, and an actual audit. State that caveat in the pack's header.

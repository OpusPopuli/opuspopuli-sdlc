# Engineering and compliance policy

<!-- Template from opuspopuli-sdlc (templates/codex/AGENTS.md). Copy to the consuming repo's root as
     AGENTS.md, or merge into an existing one. Keep it short: procedures live in the op-* skills,
     enforcement lives in the pre-push gate and CI. -->

This repo follows the opuspopuli-sdlc lifecycle. The `op-*` skills in `.agents/skills/` are the
procedures; invoke them as `$op-issue-plan`, `$op-verify`, and so on.

- Read the compliance profile at `.sdlc/compliance-profile.yaml` before planning or reviewing. With no
  profile, apply the strict PHI/PII lens.
- Plan before code: run `$op-issue-plan` for any issue and wait for human approval before editing files.
  The approved plan is persisted under `docs/plans/`.
- Never put real personal or health data in logs, error messages, fixtures, seed data or prompts. Use
  synthetic data. Run `$op-data-scan` on any change that touches personal data.
- Verify behavior, not just tests: run `$op-verify` before saying a change works.
- Do not fabricate approvals, test results, scan output or evidence. If something was not run, say so.
- Generated evidence supports compliance; it does not establish it. Never state that a change or system
  is compliant.
- Do not bypass the pre-push gate (`--no-verify`) or weaken a control without a recorded exception.

# Change record: agent-neutral compliance profile path

| Field | Value |
|---|---|
| **Change ID** | `CHG-56` |
| **Title** | Compliance profile moves from `.claude/` to `.sdlc/`, legacy path read as a deprecated fallback |
| **Issue** | [#56](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/56) |
| **Plan** | [`docs/plans/56-agent-neutral-profile.md`](../../plans/56-agent-neutral-profile.md) |
| **Branch** | `refactor/agent-neutral-profile-56` |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001` |

## What changed and why

The profile is the authoritative compliance configuration and must not belong to one agent runtime.
It now lives at `.sdlc/compliance-profile.yaml`. `.claude/compliance-profile.yaml` is still read, with
a deprecation notice; when both exist the canonical copy wins and the duplicate is reported.

## Changes

| File | Change |
|---|---|
| `controls/scripts/profile.ts` | `PROFILE_PATH`, `LEGACY_PROFILE_PATH`, `findProfile()` |
| `controls/scripts/validate-profile.ts` | `--repo <dir>` mode using `findProfile()` |
| `controls/scripts/profile.test.ts` | +5 tests (canonical, legacy, both, none, path neutrality) |
| `skills/op-data-scan`, `op-issue-plan`, `op-review`, `op-validate` | Read `.sdlc/` first; legacy noted |
| `hooks/pre-push-gate.md` | Same resolution order; `--repo` validation |
| Schema, example profile, `controls/README.md`, `docs/architecture.md`, `README.md` | New path; README gains a profile how-to and upgrade steps |
| `.claude-plugin/plugin.json` | 0.2.0 → 0.3.0 |

## Data classification

**None.** No PHI/PII/CA personal information.

## Risk register

See the plan of record. Highest: an existing consumer silently losing its profile (high × possible),
mitigated by the legacy fallback and tests for every resolution case.

## Verification evidence

- `npm run check`: all gates green; 110/110 tests (105 prior + 5 new).
- `profile:check -- --repo` exercised against temp repos with canonical, legacy, both and no profile.

## Security evidence

No new dependencies, secrets or network egress. Reads two fixed relative paths under a caller-supplied
root.

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. Consumers that already moved to `.sdlc/` would then fall back to no profile, so revert
only together with a note telling them to restore the `.claude/` copy.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass and the legacy path is preserved |
| Independent reviewer | **NOT PERFORMED** — no reviewer independent of the author/director | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

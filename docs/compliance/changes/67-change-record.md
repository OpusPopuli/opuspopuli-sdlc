# Change record: PCI DSS v4.0.1 control family

| Field | Value |
|---|---|
| **Change ID** | `CHG-67` |
| **Title** | `pci-dss` family, card-data classes, `CTL-PCI-001`–`005`, payments example profile |
| **Issue** | [#67](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/67) |
| **Plan/decision** | Repo owner, in-session 2026-10-31: PCI DSS as its own family, cited by requirement number only |
| **Branch** | `feat/pci-dss-67` (stacked on #65 → #63) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (Anthropic Claude) — AI-assisted, human-directed |
| **Controls exercised** | `CTL-SOC2-001`, `CTL-SOD-001`, `CTL-P11-001` |

## What changed and why

Consuming repos that touch cardholder data could not declare it. The new family brings two data classes
into scope for the scan and the gate (`cardholder-data`, `sensitive-authentication-data`) and maps the
SDLC-relevant PCI DSS v4.0.1 requirements to the skills that serve them:

| Control | Requirements | Implemented by |
|---|---|---|
| `CTL-PCI-001` Account data stays out of code, logs, fixtures, prompts, pre-production; SAD never stored | 3.3.1, 3.4.1, 3.5.1, 6.5.5, 6.5.6 | `op-data-scan`, `pre-push-gate`, `op-review` |
| `CTL-PCI-002` Secure development, review before release | 6.2.1, 6.2.3, 6.2.3.1, 6.2.4 | `op-review`, `pre-push-gate` |
| `CTL-PCI-003` Vulnerabilities patched; components inventoried | 6.3.1, 6.3.2, 6.3.3 | `op-security`, `pre-push-gate` |
| `CTL-PCI-004` Payment-page scripts inventoried, authorized, integrity-checked | 6.4.3, 11.6.1 | `op-review`; runtime tamper detection is the app's |
| `CTL-PCI-005` Change control; reconfirm PCI requirements after a significant change | 6.5.1–6.5.4 | `op-change-record` |

PCI DSS is copyrighted by the PCI Security Standards Council, so it is cited with the `clause` adapter
(requirement numbers, no text); a test enforces that.

## Changes

| File | Change |
|---|---|
| `controls/registry.yaml` | `pci-dss` family and label; five controls |
| `skills/op-data-scan` | Payment card section: Luhn-valid PANs outside test numbers, unmasked display, SAD (critical), unreadable storage |
| `skills/op-review` | PCI blockers: stored SAD, unmasked/readable PAN, payment-page script changes without inventory and integrity |
| `skills/op-security` | Component inventory named in the summary under `pci-dss`; control footer added |
| `skills/op-change-record` | PCI significant-change reconfirmation field |
| `hooks/pre-push-gate.md` | Payment card lens |
| `controls/examples/payments.compliance-profile.yaml` | New example profile |
| `controls/scripts/profile.test.ts` | +2 tests; example list includes payments |
| `docs/compliance-model.md`, `README.md` | Regenerated table; licensing tier; framework list |
| `.agents/skills/*` | Regenerated |
| `.claude-plugin/plugin.json` | 0.6.0 → 0.7.0 |

## Data classification

**None.**

## Risk register

| # | Risk | Severity × likelihood | Mitigation |
|---|---|---|---|
| 1 | A requirement number is wrong or moves in a later edition | medium × possible | Numbers are from PCI DSS v4.0.1; a reviewer with the licensed standard should confirm them. `clause` citations are not polled, so a new edition is a manual check |
| 2 | The PAN scan is prompt-driven, not deterministic | medium × likely | Stated; a deterministic Luhn/SAD detector is the follow-up already listed for `op-data-scan` |
| 3 | Test card numbers flagged as findings, or real PANs waved through as "test" | medium × possible | Skill distinguishes published test numbers; any other Luhn-valid number in pre-production is a finding |
| 4 | The family is read as making a repo PCI compliant | high × possible | Honesty guardrail unchanged; PCI compliance is assessed by a QSA or SAQ, not by this SDLC |

## Verification evidence

- `npm run check`: all gates green; 153/153 tests (the payments profile validates with no warnings and
  activates only PCI DSS and SOC 2 controls).

## Separation of duties

⚠️ **Not satisfied — recorded as a deviation, not waived.** Authored by Claude Code, directed by the
repo owner; no independent human review.

## Rollback plan

`git revert`. A consuming repo that already declared `pci-dss` would then fail `profile:check`, so revert
together with a note to remove the family.

## Approval

| Role | Identity | Date | Meaning of signature |
|---|---|---|---|
| Author | Claude Code (Anthropic Claude), directed by the repo owner | 2026-10-31 | Attests all gates pass |
| Independent reviewer | **NOT PERFORMED** | — | — |
| Approver | Rodney Gagnon (repo owner) — pending PR review | — | — |

# Plan of record: US state privacy pack — CCPA/CPRA (#8)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#8](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/8) |
| **Date** | 2026-07-31 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-31 (four controls, honest mappings, PDF-preferred pinning) |
| **Data classification** | None *in this repo* — authors controls about California personal information; stores none. |
| **Branch** | `feat/8-ccpa-pack` |
| **Depends on** | #1, #10 (both merged). **Completes the Opus Populi launch path.** |

**Constraint (plan-of-record #1):** single-language TypeScript, Node ≥ 22.6 native type-stripping,
no build step, deps limited to `ajv` (MIT) + `yaml` (ISC). CA statutes/regulations are government
works (public domain); we only checksum, never vendor.

## Design calls (approved)

- **Honest skill mappings.** Not every CCPA obligation is SDLC-shaped. Consumer-rights features and
  service-provider contracts are product/legal obligations; mapping them to a "gate" would overclaim.
  Rights → `op-review` + `op-issue-plan` (the SDLC reviews/plans PI features, doesn't implement
  them); service-provider contracts → `architecture` (organizational posture, no skill claim).
- **leginfo pages are dynamic HTML** — a build-time stability check (fetch twice, diff normalized
  text) guards against false drift; prefer the CPPA regulations **PDF** (`raw` byte checksum) over an
  HTML page.

## Proposed controls (family `us-state-privacy`, jurisdiction `us-ca`, applicability `[ca-personal-information]`)

| ID | Obligation | Citation | Implemented by |
|---|---|---|---|
| `CTL-CCPA-001` | Personal / sensitive PI definitions (§1798.140) | leginfo §1798.140 | `op-data-scan` |
| `CTL-CCPA-002` | Consumer rights: know/delete/correct/opt-out (§§1798.100–.121) | leginfo §1798.100 (+ §1798.120) | `op-review`, `op-issue-plan` |
| `CTL-CCPA-003` | Reasonable security & breach liability (§1798.150) | leginfo §1798.150 | `op-review`, `op-hotfix` |
| `CTL-CCPA-004` | Service-provider contract requirements (§1798.140(ag)) | leginfo §1798.140 | `architecture` (subprocessor posture) |

ID prefix `CCPA` in family `us-state-privacy` follows the existing family/prefix split (e.g.
`CTL-SOD` is family `soc2`) and leaves room for sibling states (`CTL-VCDPA-*`, …).

## Subtasks

1. **Registry entries + data class** — add the four controls; set `data_classes:
   [ca-personal-information]` on the existing `us-state-privacy` frameworks entry. Validate offline.
2. **Pin the sources (laptop egress)** — stability-check leginfo sections; pin (`text`); pin CPPA
   regs (prefer PDF `raw`). Confirm `status: active`.
3. **`op-data-scan` CCPA section** — replace placeholder with real detection categories: household
   data, unique/device identifiers, commercial/browsing history, geolocation, inferences/profiles,
   and CCPA *sensitive* PI — broader than classic PII, same exposure sinks.
4. **Tests** — `profile.test.ts`: Opus Populi profile shows `CTL-CCPA-*` active +
   `ca-personal-information` active; HIPAA/Part 11/GxP still inert; `profile:check` warning clears.
   Registry test for the new controls.
5. **Regenerate docs + README** — `docs:generate` adds the CCPA rows; document the extensible
   state-family design in `controls/README.md`.

## Risk register (severity × likelihood → mitigation)

1. leginfo HTML checksum instability → false drift in #4 — **medium × possible** → fetch-twice
   stability check; prefer stable PDF for CPPA regs; document outcome.
2. Overclaiming SDLC enforcement of product/legal obligations — **medium × possible** → rights →
   review/plan, contracts → `architecture`, honest notes; never claim a gate enforces a contract.
3. Source unreachable at build — **low × rare** (both confirmed 200) → seed `pin-pending`, pin later.
4. Regenerated table / gate drift — **low × rare** → `npm run check` before commit.
5. Control-ID scheme confusion — **low × rare** → consistent with existing split; documented.
6. AGPL / deps — **low × rare** → no new deps; CA statutes/regs are public-domain government works,
   checksummed not vendored.

## Effort

~1–1.5 focused sessions.

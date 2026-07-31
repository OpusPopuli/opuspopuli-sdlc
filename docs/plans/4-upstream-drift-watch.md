# Plan of record: upstream drift watch (#4)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#4](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/4) |
| **Date** | 2026-07-31 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-31 (file-don't-repin; one issue per source; weekly cadence) |
| **Data classification** | None — fetches only public regulatory documents; writes GitHub issues. |
| **Branch** | `feat/4-upstream-drift-watch` |
| **Depends on** | #1 (merged) |

**Constraint (plan-of-record #1):** single-language TypeScript, Node ≥ 22.6 native type-stripping,
no build step, deps limited to `ajv` (MIT) + `yaml` (ISC) — plus the built-in `fetch` for the
GitHub REST API (no new dependency).

## Deliberate choices (approved)

- **On drift, file an issue — do NOT auto-repin.** A regulation change becomes a triage item flowing
  through the SDLC, not a silent auto-applied checksum change. Re-pinning happens as part of the
  human-gated lifecycle fix. This is the CSA-native reason the issue exists.
- **One open drift issue per source, deduped by deterministic title** (`Upstream drift: <source-key>`).
  "Watcher broken" errors get their own single deduped issue, distinct from drift.

## Reuse

`check-upstream.ts` calls the same `ecfrLatestAmendment()` and `pinDocument()` that produced the
pins, but **compares** instead of writing: ecfr → live amendment date vs `pinned.amendment_date`;
document → live sha256 vs `pinned.sha256`; eurlex → skipped (none until #7); clause → never polled
(workflow summary says so — an AC).

## Subtasks

1. **`controls/scripts/check-upstream.ts` — pure core + tests.** Exported/tested offline:
   `diffEcfr`/`diffDocument`, `affectedControls(registry, sourceKey)`, `driftIssueTitle`/
   `driftIssueBody`, `selectNewIssues(findings, errors, openTitles)` (dedup). `--dry-run` fetches
   live and prints findings without touching GitHub. `check-upstream.test.ts` covers the pure
   functions with injected data.
2. **Issue-filing IO (`main()`).** GitHub REST via `GITHUB_TOKEN` + `$GITHUB_REPOSITORY`: list open
   `upstream-drift` issues, create the missing drift issues, file/refresh one "watcher broken" issue
   on any fetch/shape error. 2–3 attempt fetch retry so a flake doesn't file a false "broken" issue.
   Plain `fetch`, no `gh` dependency.
3. **`.github/workflows/upstream-drift.yml`.** Weekly `schedule` cron + `workflow_dispatch`; Node
   from `.nvmrc`; `npm ci`; run `check-upstream`. `permissions: { issues: write, contents: read }`;
   no secrets beyond `GITHUB_TOKEN`. Run summary: copyrighted frameworks (GAMP 5, SOC 2 TSC, ISO)
   out of scope — manual new-edition checks.
4. **Verify + docs.** Run `--dry-run` from the laptop against live sources — expect **zero drift**
   (everything pinned to current today), proving the comparison logic. Dispatch the deployed workflow
   once (the AC's "verify endpoints from the workflow itself"). Document the watcher in
   `controls/README.md`; keep `npm run check` green.

**Triage-label reconciliation:** `op-issue-triage` operates on *unlabeled* issues, so drift issues
carry only a marker label `upstream-drift` (dedup/filtering) and **no type/priority label** — they
still read as "needs triage" and `/op-issue-triage` classifies them.

## Risk register (severity × likelihood → mitigation)

1. eCFR/FDA endpoint shape change → watcher silently wrong — **medium × possible** → code throws
   loudly on unexpected shape (already does); that path files a "watcher broken" issue, not a green pass.
2. Duplicate-issue spam — **medium × possible** → dedup by deterministic title, one open issue per
   source; unit-tested `selectNewIssues`.
3. Transient network flake files a false "broken" issue — **low × possible** → 2–3 attempt retry; a
   self-resolving weekly blip is low-noise.
4. `GITHUB_TOKEN` cannot create issues — **low × rare** → `permissions: issues: write`.
5. Unstable document checksums (leginfo `text`) → false drift — **low × possible** → §1798.140
   verified stable across fetches in #8; a false positive is a human-dismissed issue, not a broken build.
6. AGPL / deps — **low × rare** → no new deps; built-in `fetch` + existing `yaml`.

## Effort

~1–1.5 focused sessions.

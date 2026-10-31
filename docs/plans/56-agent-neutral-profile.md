# Plan of record: move the compliance profile to an agent-neutral path (#56)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#56](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/56) |
| **Date** | 2026-10-31 |
| **Author** | Claude Code (AI-assisted, human-directed) |
| **Approved by** | Repo owner, in-session, 2026-10-31 ("go forth") |
| **Data classification** | None. Repo metadata, markdown and tooling only. |
| **Branch** | `refactor/agent-neutral-profile-56` |
| **Related** | Follow-ups: provider-neutral review gate, Codex skill packaging |

## The defect

The consuming-repo compliance profile is the authoritative compliance configuration, but it lives at
`.claude/compliance-profile.yaml`: a directory owned by one agent runtime. Four skills, the gate spec,
the schema and the docs read it there. Adding a second runtime would force a duplicate profile that can
drift, or let one agent own the other's compliance config.

## Deliberate choices

- **`.sdlc/` as the canonical home.** Named for the process, not a tool. Both agents read one file.
- **Keep reading `.claude/` as a deprecated fallback.** Breaking every existing consumer to rename a path
  would be the wrong trade. The fallback is reported, never silent.
- **Canonical wins when both exist, and the duplicate is flagged.** Two profiles that can disagree are a
  defect.
- **Resolution order encoded once in `findProfile()`, with tests.** Skills restate the same order in
  prose, because they are instructions, not a runtime.
- **Minor bump (0.2.0 → 0.3.0).** `skills/` and `hooks/` changed; consumers cache by version.

## Subtasks

1. `profile.ts`: `PROFILE_PATH`, `LEGACY_PROFILE_PATH`, `findProfile(repoRoot)`.
2. `validate-profile.ts`: `--repo <dir>` resolves a consumer's profile the same way.
3. Skills `op-data-scan`, `op-issue-plan`, `op-review`, `op-validate`; `hooks/pre-push-gate.md`.
4. Schema description, example profile comment, `controls/README.md`, `docs/architecture.md`, README
   (new "Declare your compliance profile" how-to with an upgrade path).
5. Tests in temp dirs only; version bump; change record.

## Risk register (severity × likelihood → mitigation)

1. **Existing consumers lose their profile and silently fall back to no-profile** — high × possible →
   legacy path still read; every skill names both paths; `findProfile` tested for each case.
2. **Canonical and legacy copies drift** — medium × possible → canonical wins; duplicate reported by
   `findProfile` and by the skills.
3. **Test fixtures touch the working tree** — high × rare → fixtures built in `mkdtemp`, removed in
   `finally`.
4. **Consumers keep the cached 0.2.0** — medium × certain without a bump → bumped; version guard enforces.
5. **Dependency/licence risk** — low × rare → none added.

## Effort

One focused session.

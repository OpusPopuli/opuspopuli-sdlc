---
name: op-release
description: Prepare a release — changelog, semver bump, release notes, and the validation evidence pack. Use to cut a develop→main release.
argument-hint: <release version, e.g. v1.4.0>
---

Prepare release $ARGUMENTS.

1. Fetch all PRs merged to main since the last release tag via GitHub MCP
2. Group by type: features | bug fixes | chores | breaking changes
3. Generate a CHANGELOG.md entry in Keep a Changelog format
4. Suggest the correct semver bump based on changes (breaking = major, features = minor, fixes = patch)
5. Draft release notes suitable for GitHub Releases
6. Check that all linked issues are closed
7. List any PRs that are merged but missing a linked issue
8. Run `/op-validate <version>` to assemble the release validation / qualification evidence pack

Show me the full changelog entry, release notes, and validation pack for approval before tagging.

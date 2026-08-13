---
name: op-release
description: Prepare a release — changelog, semver bump, release notes, and the validation evidence pack. Use before tagging a release.
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

**Do not create the tag without that approval.** Where a repo triggers its release
pipeline from a `v*` tag, pushing the tag *is* the act of shipping — it builds, signs
and publishes production images. Treat it as the deploy step it is, not as
bookkeeping that follows one.

Confirm the tag does not already exist, and that the published release history has no
gaps. A pipeline that builds on merge but tags by hand will silently skip versions:
the artifacts ship while the release record stops moving, and nothing fails. If earlier
releases are untagged, say so — backfilling them is usually the right call before
adding another.

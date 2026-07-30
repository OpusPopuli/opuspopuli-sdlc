---
name: op-issue-create
description: Create a well-structured GitHub issue (bug/feature/chore) from a rough description. Use when filing new work.
argument-hint: <description of the bug, feature, or chore>
---

Create a GitHub issue from the following input: $ARGUMENTS

Steps:
1. Identify whether this is a bug, feature, or chore
2. Write a clear, concise title (imperative mood for features, "X causes Y" for bugs)
3. Draft the issue body using this structure:
   - **Context**: Why this matters
   - **Current behavior** (bugs) or **Goal** (features)
   - **Expected behavior** / **Acceptance criteria**
   - **Technical notes**: Relevant files, services, or constraints in the stack
   - **Data classification**: does this involve PHI/PII/regulated data? (flag it early — it drives review)
   - **Labels**: Suggest appropriate labels (bug/feature/chore + affected service)
4. Ask me to confirm before creating it via the GitHub MCP

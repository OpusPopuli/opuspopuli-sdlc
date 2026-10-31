---
name: op-issue-create
description: Create a well-structured GitHub issue (bug/feature/chore) from a rough description. Use when filing new work.
---

<!-- GENERATED from skills/op-issue-create/SKILL.md (opuspopuli-sdlc v0.7.0) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<description of the bug, feature, or chore>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Create a GitHub issue from the following input: {input}

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

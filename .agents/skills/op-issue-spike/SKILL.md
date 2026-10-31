---
name: op-issue-spike
description: Run a time-boxed technical spike (investigation only, no production code) and produce a recommendation. Use to de-risk an unknown before committing to an approach.
---

<!-- GENERATED from skills/op-issue-spike/SKILL.md (opuspopuli-sdlc v0.5.1) by
     controls/scripts/generate-agent-skills.ts. Edit the source, then run `npm run skills:generate`. -->

**Input:** `<the question or area to investigate>`. Codex has no argument substitution: take `{input}`
from the user's request, and ask for it if the request does not say.

Run a technical spike on: {input}

This is an investigation only — produce no production code.

1. Define the question(s) this spike must answer
2. Survey the relevant parts of the codebase for existing patterns
3. Consider 2-3 approaches with tradeoffs (performance, complexity, licensing)
4. Account for stack constraints: NestJS microservices, pgvector, self-hosted embeddings/LLM, AGPL-3.0
5. Produce a clear recommendation with rationale
6. Identify follow-up issues to create

Output a spike document I can commit to docs/ or link from the issue.

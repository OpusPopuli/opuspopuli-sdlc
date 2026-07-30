---
name: op-issue-spike
description: Run a time-boxed technical spike (investigation only, no production code) and produce a recommendation. Use to de-risk an unknown before committing to an approach.
argument-hint: <the question or area to investigate>
---

Run a technical spike on: $ARGUMENTS

This is an investigation only — produce no production code.

1. Define the question(s) this spike must answer
2. Survey the relevant parts of the codebase for existing patterns
3. Consider 2-3 approaches with tradeoffs (performance, complexity, licensing)
4. Account for stack constraints: NestJS microservices, pgvector, self-hosted embeddings/LLM, AGPL-3.0
5. Produce a clear recommendation with rationale
6. Identify follow-up issues to create

Output a spike document I can commit to docs/ or link from the issue.

# Plan of record: consuming-repo compliance profile contract + profile-driven scan (#10)

| | |
|---|---|
| **Issue** | [OpusPopuli/opuspopuli-sdlc#10](https://github.com/OpusPopuli/opuspopuli-sdlc/issues/10) |
| **Date** | 2026-07-31 |
| **Author** | Claude (AI-assisted, human-approved via plan review) |
| **Approved by** | Repo owner, in-session, 2026-07-31 (rename `op-phi-scan` → `op-data-scan` approved; single PR) |
| **Data classification** | None *in this repo* — ships schema/tooling/skill-prose governing how a consuming repo's regulated data is detected; stores none itself. |
| **Branch** | `feat/10-compliance-profile` |
| **Depends on** | #1, #3 (merged). **#8 depends on this.** |

**Constraint (plan-of-record #1):** single-language TypeScript, Node ≥ 22.6 native type-stripping,
no build step, deps limited to `ajv` (MIT) + `yaml` (ISC).

## Honesty framing (load-bearing)

Skills are markdown instructions to an AI, not executable code. "Inertness enforced" is therefore
two layers, stated plainly in the docs so we don't overclaim:
- **Code-enforced:** `validate-profile.ts` rejects a profile with a family the registry lacks;
  pure `resolveProfile()` computes the active-vs-inert partition, unit-tested (inertness is
  *demonstrable*).
- **Instruction-enforced:** at execution time the scan/review skills honor the profile because
  their prose says to — not because a runtime sandbox blocks them.

## Sequencing (avoids collision with #8)

#10 introduces `us-state-privacy` as a **declared family with a label and zero controls** (validate
already allows a family with no controls) so the Opus Populi example validates and inertness is
demonstrable now. **#8 populates it** with actual CCPA controls + data classes.

## Subtasks

1. **Profile schema + examples** — `controls/schema/compliance-profile.schema.json`;
   `controls/examples/opuspopuli.compliance-profile.yaml` (`[us-state-privacy, soc2]`) + a `hipaa`
   example. Documents the consuming-repo location `.claude/compliance-profile.yaml`. Profile =
   `families` + optional `applicability` narrowing.
2. **Registry data-class mechanism** — optional `data_classes: [slug]` on `frameworks:` entries +
   schema; seed `hipaa → [phi-pii]`; add `us-state-privacy` family (label, no controls yet). The
   hook packs #7/#8 extend.
3. **`profile.ts` + `validate-profile.ts`** — pure `resolveProfile(registry, profile)` →
   `{ activeFamilies, activeControls, activeDataClasses, activeEvidence, inertControls }`; validator
   checks profile ⊆ registry. `npm run profile:check`; example-profile validation folded into
   `npm run check` so #3's gate covers the committed examples.
4. **Scan generalization (rename)** — `op-phi-scan` → `op-data-scan`: profile-driven, applies active
   data classes, **HIPAA/PHI section preserved verbatim** when `hipaa` active, documented
   placeholder sections for CCPA (#8)/GDPR (#7). Update registry `implemented_by`; regenerate docs.
5. **Skill/gate wiring** — consistent "compliance-profile scoping" paragraph in `op-validate`,
   `op-review`, `op-issue-plan`, `hooks/pre-push-gate.md`: consult profile, scope
   framework-conditional checks, keep framework-agnostic behaviors (plans, change records,
   traceability) unconditional. No-profile default = framework-agnostic lifecycle + visible "no
   compliance profile declared" note in evidence packs.
6. **Tests + docs** — `profile.test.ts`: Opus Populi profile → SOC 2 active, HIPAA/Part 11/GxP/ISO
   inert (headline); no-profile default; invalid/unknown-family rejected. `controls/README.md`
   documents the contract, worked example, and no-profile default.

**Scope guard:** ships the contract + tooling + skill prose, validated against **example** profiles
in this repo's gate. Consuming-repo CI wiring is that repo's adoption step (Opus Populi) — out of
scope, documented.

## Risk register (severity × likelihood → mitigation)

1. Overclaiming "enforced" inertness — **medium × possible** → two-layer framing in docs; never
   claim runtime sandboxing.
2. Rename breaks registry/doc/hook refs — **medium × possible** → `reconcile` + `docs:check` gates
   catch stale refs; rename pre-launch when cost is lowest.
3. Zero-control `us-state-privacy` family confuses validate/table — **low × possible** → validate
   allows family-without-controls; control-driven table shows no row; test covers.
4. Profile schema too rigid for #7/#8 narrowing — **low × possible** → applicability narrowing is an
   optional open-vocab list mirroring the registry's open applicability axis.
5. Consuming repo can't easily run the validator (distribution) — **medium × likely** → scope
   honestly: repo ships tool + validates committed examples; consuming-repo CI wiring is their
   documented adoption step.
6. AGPL / deps — **low × rare** → no new deps; reuse `ajv`/`yaml`.

## Effort

~1.5–2 focused sessions (six subtasks, one skill rename). Single PR.

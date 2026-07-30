---
name: op-verify
description: Behavioral end-to-end verification of a change — drive the real flow and observe, not just run tests. Use after implementing before claiming a change works.
argument-hint: <what the change is supposed to do> (optional; defaults to the current diff)
---

Verify that the current change actually does what it is supposed to — by exercising it end-to-end and
observing behavior, not by trusting that unit tests passing means it works. Context: $ARGUMENTS

1. Identify the user-facing (or service-facing) flow this change affects. If the `verify` skill exists,
   use it to bootstrap/drive the flow; otherwise drive it directly (API call, GraphQL query, UI path, worker job).
2. Put the change in its **real runtime**: start the affected service(s) or worker, hit the federated
   gateway, run the actual query/mutation or trigger the job — do not stub the layer under test.
3. Observe the actual output and side effects: response shape, DB rows written, queue messages, logs.
   Compare against the intended behavior from the issue/plan.
4. Exercise the **failure and edge paths**, not just the happy path (empty input, unauthorized caller,
   missing record, retry).
5. **Regulated-data observation (HIPAA):** while driving the flow, confirm no PHI/PII appears in logs,
   error responses, or audit entries that should be masked. Note what you observed as evidence.
6. Report: what you drove, what you observed, pass/fail per path, and anything that tests would NOT have caught.

This produces the behavioral-verification evidence that `/op-change-record` and `/op-validate` cite.
Do not claim a change works until you have driven it and observed it here.

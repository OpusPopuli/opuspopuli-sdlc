// Fail-closed tests for the review gate (#58). The executor is injected, so no model or CLI runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decide,
  parseResult,
  runReview,
  providerCommand,
  parseArgs,
  buildPrompt,
  type ExecOutcome,
  type Executor,
} from "./review-gate.ts";

const ok = (output: string): ExecOutcome => ({ exitCode: 0, timedOut: false, notFound: false, output });
const PASS = '{"verdict":"pass","findings":[]}';

test("a clean review with no findings passes", () => {
  assert.equal(decide("claude", ok(PASS)).blocked, false);
});

// Every way the review can fail to complete must block.
for (const [name, outcome] of [
  ["provider not installed", { exitCode: null, timedOut: false, notFound: true, output: "" }],
  ["timeout", { exitCode: null, timedOut: true, notFound: false, output: PASS }],
  ["non-zero exit, even with a passing body", { exitCode: 2, timedOut: false, notFound: false, output: PASS }],
  ["empty output", ok("")],
  ["prose instead of JSON", ok("Looks good to me!")],
  ["JSON with no verdict", ok('{"findings":[]}')],
  ["unknown verdict", ok('{"verdict":"lgtm","findings":[]}')],
  ["findings not an array", ok('{"verdict":"pass","findings":"none"}')],
  ["finding with unknown severity", ok('{"verdict":"pass","findings":[{"severity":"meh","message":"x"}]}')],
  ["finding with no message", ok('{"verdict":"pass","findings":[{"severity":"low"}]}')],
  ["JSON followed by prose", ok(`${PASS}\nAlso, nice work.`)],
] as const) {
  test(`fail closed: ${name}`, () => {
    const d = decide("codex", outcome as ExecOutcome);
    assert.equal(d.blocked, true, d.reason);
  });
}

test("a critical or high finding blocks even when the verdict says pass", () => {
  for (const severity of ["critical", "high"]) {
    const out = `{"verdict":"pass","findings":[{"severity":"${severity}","file":"a.ts","line":3,"message":"SSN logged"}]}`;
    const d = decide("claude", ok(out));
    assert.equal(d.blocked, true);
    assert.match(d.reason, /critical\/high/);
  }
});

test("medium and low findings are reported but do not block", () => {
  const out = '{"verdict":"pass","findings":[{"severity":"medium","message":"m"},{"severity":"low","message":"l"}]}';
  const d = decide("claude", ok(out));
  assert.equal(d.blocked, false);
  assert.equal(d.result?.findings.length, 2);
});

test('verdict "block" with only low findings still blocks (the stricter signal wins)', () => {
  const d = decide("claude", ok('{"verdict":"block","findings":[{"severity":"low","message":"x"}]}'));
  assert.equal(d.blocked, true);
});

test("one fenced JSON block is tolerated", () => {
  assert.deepEqual(parseResult("```json\n" + PASS + "\n```"), { verdict: "pass", findings: [] });
});

test("an empty diff passes without invoking the provider", () => {
  let called = false;
  const exec: Executor = () => {
    called = true;
    return ok(PASS);
  };
  const d = runReview({ provider: "codex", lens: "code", diff: "  \n", profile: null, timeoutMs: 1000 }, exec);
  assert.equal(d.blocked, false);
  assert.equal(called, false);
});

test("runReview hands the provider the diff and the profile on stdin", () => {
  let seen = "";
  const exec: Executor = (_cmd, stdin) => {
    seen = stdin;
    return ok(PASS);
  };
  runReview({ provider: "claude", lens: "security", diff: "+console.log(ssn)", profile: "families: [hipaa]", timeoutMs: 1000 }, exec);
  assert.ok(seen.includes("+console.log(ssn)"));
  assert.ok(seen.includes("families: [hipaa]"));
});

test("codex runs read-only, schema-constrained, with the final message written to a file", () => {
  const cmd = providerCommand("codex", "/tmp/out.txt", "/tmp/schema.json");
  assert.equal(cmd.bin, "codex");
  for (const a of ["exec", "--sandbox", "read-only", "--output-schema", "/tmp/schema.json", "-o", "/tmp/out.txt", "-"]) {
    assert.ok(cmd.args.includes(a), `missing ${a}`);
  }
  assert.ok(!cmd.args.some((a) => a.includes("dangerously")));
});

test("claude runs in print mode", () => {
  assert.deepEqual(providerCommand("claude", "/x", "/y"), { bin: "claude", args: ["--print", "--output-format", "text"] });
});

test("the security prompt falls back to the strict PHI/PII lens with no profile", () => {
  const p = buildPrompt("security", "+x", null);
  assert.match(p, /none declared/);
  assert.match(p, /PHI\/PII/);
});

test("argument parsing rejects an unknown provider, lens, or timeout", () => {
  assert.throws(() => parseArgs(["--provider", "gpt", "--lens", "code"]));
  assert.throws(() => parseArgs(["--provider", "codex", "--lens", "style"]));
  assert.throws(() => parseArgs(["--provider", "codex", "--lens", "code", "--timeout", "0"]));
  assert.deepEqual(parseArgs(["--provider", "codex", "--lens", "code"]), {
    provider: "codex",
    lens: "code",
    base: "origin/main",
    timeoutS: 300,
    evidence: undefined,
  });
});

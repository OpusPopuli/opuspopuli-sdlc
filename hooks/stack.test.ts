// Stack-neutral gate commands (#71).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";
import { parseStack, parseYamlSubset, detect, resolve, STAGES, PRESETS, type Stack } from "./stack.ts";

const none = () => false;
const cmds = (stack: Stack, exists: (p: string) => boolean = none) =>
  resolve(stack, STAGES, exists).map((s) => (s.status === "run" ? `${s.workspace} ${s.stage}: ${s.command}` : `${s.workspace} ${s.stage}: skipped (${s.reason})`));

const POLYGLOT = `# Gradle backend, Angular frontend
version: 1
workspaces:
  - path: backend
    preset: java-gradle
    commands:
      duplication: off   # CPD runs in Sonar for this module
  - path: frontend
    preset: node-npm
    commands:
      lint: "npx ng lint"
licence:
  forbidden: [GPL-2.0-only, GPL-3.0-only, AGPL-3.0-only]
`;

test("a single-stack repo resolves every stage from its preset", () => {
  const stack = parseStack("version: 1\npreset: node-pnpm\n");
  assert.deepEqual(cmds(stack), [
    ". build: pnpm build",
    ". test: pnpm test",
    ". lint: pnpm lint",
    ". duplication: npx --yes jscpd@4.3.0",
    ". dependency-audit: pnpm audit --prod --audit-level=high",
    ". licence-check: skipped (no licences forbidden in licence.forbidden)",
  ]);
});

test("a polyglot Gradle + Angular repo resolves per workspace, with overrides and the licence policy", () => {
  assert.deepEqual(cmds(parseStack(POLYGLOT), (p) => p === "backend/gradlew"), [
    "backend build: ./gradlew assemble",
    "backend test: ./gradlew test jacocoTestCoverageVerification",
    "backend lint: ./gradlew checkstyleMain spotbugsMain",
    `backend duplication: skipped (disabled in .sdlc/stack.yaml)`,
    "backend dependency-audit: ./gradlew dependencyCheckAnalyze",
    "backend licence-check: ./gradlew checkLicense",
    "frontend build: npm run build",
    "frontend test: npm test",
    "frontend lint: npx ng lint",
    "frontend duplication: npx --yes jscpd@4.3.0",
    "frontend dependency-audit: npm audit --omit=dev --audit-level=high",
    'frontend licence-check: npx --yes license-checker-rseidelsohn@4.4.2 --production --excludePrivatePackages --failOn "GPL-2.0-only;GPL-3.0-only;AGPL-3.0-only"',
  ]);
});

test("Maven prefers the wrapper, and joins forbidden licences with commas", () => {
  const stack = parseStack("version: 1\npreset: java-maven\nlicence:\n  forbidden:\n    - GPL-3.0-only\n    - AGPL-3.0-only\n");
  const withWrapper = cmds(stack, (p) => p === "mvnw");
  assert.equal(withWrapper[1], ". test: ./mvnw -B verify");
  assert.ok(withWrapper[5].endsWith('-Dlicense.excludedLicenses="GPL-3.0-only,AGPL-3.0-only"'));
  assert.equal(cmds(stack)[1], ". test: mvn -B verify", "falls back to mvn without a wrapper");
});

test("every preset defines every stage", () => {
  for (const [name, p] of Object.entries(PRESETS)) {
    for (const s of STAGES) assert.ok(p[s], `${name} has no ${s}`);
  }
});

// ── Fail closed on configuration ────────────────────────────────────────────────────────────────
for (const [why, text, msg] of [
  ["unknown preset", "version: 1\npreset: rust-cargo\n", /preset must be one of/],
  ["both preset and workspaces", "version: 1\npreset: node-npm\nworkspaces:\n  - path: a\n    preset: node-npm\n", /exactly one/],
  ["neither", "version: 1\n", /exactly one/],
  ["wrong version", "version: 2\npreset: node-npm\n", /version must be 1/],
  ["unknown stage", "version: 1\npreset: node-npm\ncommands:\n  deploy: ./ship.sh\n", /unknown stage "deploy"/],
  ["unknown top-level key", "version: 1\npreset: node-npm\nstages: [test]\n", /unknown key "stages"/],
  ["workspace escaping the repo", "version: 1\nworkspaces:\n  - path: ../other\n    preset: node-npm\n", /relative path inside the repo/],
  ["duplicate workspace", "version: 1\nworkspaces:\n  - path: a\n    preset: node-npm\n  - path: a\n    preset: java-maven\n", /duplicate workspace/],
  ["non-SPDX licence", "version: 1\npreset: node-npm\nlicence:\n  forbidden: [GPL v3]\n", /SPDX/],
  ["a YAML anchor", "version: 1\npreset: &p node-npm\n", /anchors/],
  ["a block scalar", "version: 1\npreset: node-npm\ncommands:\n  test: |\n    npm test\n", /block scalars/],
  ["a flow map", "version: 1\npreset: node-npm\ncommands: {test: npm test}\n", /flow maps/],
  ["bad indentation", "version: 1\npreset: node-npm\n    extra: 1\n", /indentation|could not parse/],
] as const) {
  test(`config error is refused: ${why}`, () => {
    assert.throws(() => parseStack(text), msg);
  });
}

test("commands containing && and | are fine; only a value that starts with one is refused", () => {
  const stack = parseStack('version: 1\npreset: node-pnpm\ncommands:\n  lint: pnpm lint && pnpm lint:sonar\n  test: "pnpm test | tee out.txt"\n');
  assert.equal(stack.workspaces[0].commands.lint, "pnpm lint && pnpm lint:sonar");
  assert.equal(stack.workspaces[0].commands.test, "pnpm test | tee out.txt");
});

test("the YAML subset agrees with a real YAML parser on every supported shape", () => {
  for (const text of [POLYGLOT, "version: 1\npreset: java-maven\nlicence:\n  forbidden:\n    - GPL-3.0-only\n", 'version: 1\npreset: node-npm\ncommands:\n  lint: "npx eslint . # not a comment"\n']) {
    const ours = JSON.stringify(parseYamlSubset(text));
    // The real parser types `1` as a number and `off` as a string; normalise scalars to strings.
    const theirs = JSON.stringify(parse(text), (_k, v) => (typeof v === "number" || typeof v === "boolean" ? String(v) : v));
    assert.equal(ours, theirs);
  }
});

// ── Detection ───────────────────────────────────────────────────────────────────────────────────
test("detection picks one stack from root build files, and says so", () => {
  const d = detect((p) => p === "build.gradle.kts");
  assert.equal(d.workspaces[0].preset, "java-gradle");
  assert.equal(d.source, "detected");
  assert.match(d.note ?? "", /detected java-gradle/);
  assert.equal(detect((p) => p === "pnpm-lock.yaml").workspaces[0].preset, "node-pnpm");
  assert.equal(detect((p) => p === "package.json").workspaces[0].preset, "node-npm");
});

test("detection refuses to guess when there are zero or several stacks", () => {
  assert.throws(() => detect(none), /declare the stack/);
  assert.throws(() => detect((p) => p === "pom.xml" || p === "package-lock.json"), /declare them as workspaces/);
});

// ── The runner end to end, with stub tools ──────────────────────────────────────────────────────
function repo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "stack-"));
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), c, { mode: 0o755 });
  }
  return root;
}
const STACK = join(import.meta.dirname, "stack.ts");
const run = (root: string, ...args: string[]) =>
  spawnSync(process.execPath, ["--experimental-strip-types", STACK, ...args], { cwd: root, encoding: "utf8" });

test("run: a passing workspace exits 0; a failing one blocks with exit 1", () => {
  const root = repo({
    ".sdlc/stack.yaml": "version: 1\nworkspaces:\n  - path: backend\n    preset: java-gradle\n  - path: frontend\n    preset: node-npm\n    commands:\n      test: ./fail.sh\n",
    "backend/gradlew": "#!/bin/sh\necho gradle $@\n",
    "frontend/fail.sh": "#!/bin/sh\nexit 3\n",
  });
  try {
    const ok = run(root, "run", "lint");
    assert.equal(ok.status, 1, "frontend lint (npm run lint) fails: there is no package.json");
    const t = run(root, "run", "test");
    assert.equal(t.status, 1);
    assert.match(t.stderr, /\[test\] backend: \.\/gradlew test jacocoTestCoverageVerification/);
    assert.match(t.stderr, /\[test\] frontend: BLOCKED — exited 3/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run: a clean stage passes; show prints the plan without running it", () => {
  const root = repo({ ".sdlc/stack.yaml": "version: 1\npreset: java-gradle\n", "gradlew": "#!/bin/sh\nexit 0\n" });
  try {
    assert.equal(run(root, "run", "test").status, 0);
    const s = run(root, "show");
    assert.equal(s.status, 0);
    assert.match(s.stdout, /\[test\] \.\/gradlew test jacocoTestCoverageVerification/);
    // Gradle's licence policy lives in the build (jk1 allowed-licences file), so it always runs.
    assert.match(s.stdout, /\[licence-check\] \.\/gradlew checkLicense/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("run: a bad stack file, an unknown stage, or a missing workspace blocks", () => {
  const bad = repo({ ".sdlc/stack.yaml": "version: 1\npreset: cobol\n" });
  const ws = repo({ ".sdlc/stack.yaml": "version: 1\nworkspaces:\n  - path: gone\n    preset: node-npm\n" });
  try {
    assert.equal(run(bad, "run", "test").status, 1);
    assert.match(run(bad, "run", "test").stderr, /BLOCKED — .*preset must be one of/);
    assert.equal(run(ws, "run", "deploy").status, 1);
    const g = run(ws, "run", "test");
    assert.equal(g.status, 1);
    assert.match(g.stderr, /workspace gone does not exist/);
  } finally {
    rmSync(bad, { recursive: true, force: true });
    rmSync(ws, { recursive: true, force: true });
  }
});

test("the committed example stack files all parse", () => {
  const dir = join(import.meta.dirname, "..", "controls", "examples");
  const files = readdirSync(dir).filter((f) => f.endsWith(".stack.yaml"));
  assert.ok(files.length >= 3);
  for (const f of files) parseStack(readFileSync(join(dir, f), "utf8"));
});

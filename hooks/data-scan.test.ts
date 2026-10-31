// Deterministic data scanner (#70). Every case is a literal line, so the tests are the rule spec.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  scanLines,
  blocking,
  parseDiff,
  parseFamilies,
  parseAllowlist,
  classesFor,
  cardNetwork,
  luhn,
  locationOf,
  sinkOf,
  globToRegExp,
  FAMILY_CLASSES,
  type AddedLine,
  type DataClass,
} from "./data-scan.ts";

const ALL = new Set<DataClass>(["phi-pii", "ca-personal-information", "cardholder-data", "sensitive-authentication-data"]);
const scan = (file: string, text: string, classes = ALL) => scanLines([{ file, line: 1, text }], classes);
const rules = (file: string, text: string, classes = ALL) => scan(file, text, classes).map((f) => `${f.rule}:${f.severity}`);

// Non-test card numbers that pass Luhn with a real network prefix (generated for these tests).
const VISA = "4539578763621486";
const AMEX = "371234567890120";

test("Luhn and network checks", () => {
  assert.equal(luhn(VISA), true);
  assert.equal(cardNetwork(VISA), "visa");
  assert.equal(cardNetwork("1698765432123"), null, "a 13-digit epoch-ms timestamp is not a card");
  assert.equal(cardNetwork("4539578763621"), "visa");
  assert.equal(cardNetwork("45395787636214"), null, "Visa does not issue 14-digit numbers");
});

// ── Card data ──────────────────────────────────────────────────────────────────────────────────
test("a real-looking PAN in a Java log call is critical", () => {
  assert.deepEqual(rules("src/main/java/com/acme/Pay.java", `log.info("charging card ${VISA}");`), ["pan:critical"]);
});

test("a PAN with spaces or dashes is still a PAN", () => {
  assert.deepEqual(rules("app/pay.ts", `const card = "4539 5787 6362 1486";`), ["pan:high"]);
  assert.deepEqual(rules("app/pay.ts", `const card = "4539-5787-6362-1486";`), ["pan:high"]);
});

test("published test card numbers are allowed in fixtures", () => {
  assert.deepEqual(rules("src/test/resources/cards.json", `{"pan": "4111111111111111"}`), []);
  assert.deepEqual(rules("app/pay.spec.ts", `card: "4242 4242 4242 4242"`), []);
});

test("long numeric IDs and timestamps are not card numbers", () => {
  assert.deepEqual(rules("app/x.ts", `const createdAt = 1698765432123;`), []);
  assert.deepEqual(rules("app/x.ts", `const tweetId = "1719283746501928374";`), []);
  assert.deepEqual(rules("app/x.ts", `const v = 4539578763621486.5;`), [], "a float is not a PAN");
});

test("track data and CVV literals are critical anywhere, even in tests", () => {
  assert.deepEqual(rules("src/test/java/PayTest.java", `String t = ";${VISA}=2512101?";`), ["pan:high", "track-data:critical"]);
  assert.deepEqual(rules("app/pay.ts", `const req = { cvv: "123" };`), ["cvv:critical"]);
  assert.deepEqual(rules("app/pay.py", `payload = {"card_security_code": "4321"}`), ["cvv:critical"]);
});

// ── Identifiers ────────────────────────────────────────────────────────────────────────────────
test("an SSN in seed data is high; documentation placeholders are ignored", () => {
  assert.deepEqual(rules("supabase/seed.sql", `insert into users values ('Ann', '512-44-9081');`), ["ssn:high"]);
  assert.deepEqual(rules("docs/api.md", `Example SSN: 123-45-6789`), []);
  assert.deepEqual(rules("app/x.ts", `const r = "900-12-3456";`), [], "9xx area numbers are never issued");
});

test("dates and versions are not SSNs", () => {
  assert.deepEqual(rules("app/x.ts", `const d = "2024-01-15"; const v = "1.12.0";`), []);
});

test("a Medicare Beneficiary Identifier is detected, with or without dashes", () => {
  assert.deepEqual(rules("src/test/resources/member.json", `{"mbi": "1EG4TE5MK73"}`), ["mbi:high"]);
  assert.deepEqual(rules("src/test/resources/member.json", `{"mbi": "1EG4-TE5-MK73"}`), ["mbi:high"]);
  assert.deepEqual(rules("app/x.ts", `const k = "ABCDEFGHIJK";`), []);
});

test("real-looking emails are reported only in test and seed data, and never block", () => {
  assert.deepEqual(rules("app/user.spec.ts", `email: "jane.doe@gmail.com"`), ["email:medium"]);
  assert.deepEqual(rules("app/user.spec.ts", `email: "jane@example.com"`), []);
  assert.deepEqual(rules("app/user.ts", `const support = "help@acme.io";`), []);
  assert.deepEqual(blocking(scan("app/user.spec.ts", `email: "jane.doe@gmail.com"`)), []);
});

test("institutional, role and placeholder addresses are not personal data", () => {
  for (const e of ["clerk@sonoma-county.ca.gov", "info@army.mil", "privacy@opuspopuli.org", "support@acme.io", "test@test.com", "a@b.com", "t@e.com", "user@domain.com"]) {
    assert.deepEqual(rules("app/user.spec.ts", `email: "${e}"`), [], e);
  }
});

// ── Sensitive fields reaching a sink, per language ─────────────────────────────────────────────
for (const [file, text, expected] of [
  ["src/main/java/Claims.java", `LOGGER.info("Member {} filed", member.getMemberId());`, "sink:medical-id:high"],
  ["src/main/java/Claims.java", `throw new IllegalStateException("bad ssn " + patient.ssn);`, "sink:ssn:high"],
  ["src/main/kotlin/Pay.kt", `logger.debug("card={}", request.cardNumber)`, "sink:pan:high"],
  ["src/app/claims.component.ts", "console.log(`visit ${patient.dateOfBirth}`);", "sink:dob:medium"],
  ["src/app/claims.service.ts", "this.logger.error('lookup failed', { mrn: claim.mrn });", "sink:medical-id:high"],
  ["svc/claims.py", `logger.info(f"member {member.member_id} diagnosis {dx.diagnosis}")`, "sink:medical-id:high,sink:health:high"],
  ["svc/claims.go", `log.Printf("ssn=%s", p.SSN)`, "sink:ssn:high"],
  ["Svc/Claims.cs", `_logger.LogWarning("cvv {Cvv}", payment.Cvv);`, "sink:card-security:critical"],
  ["app/llm.ts", "const prompt = `Summarize claims for ${patient.medicareId}`;", "sink:medical-id:high"],
] as const) {
  test(`sink: ${file}`, () => {
    assert.deepEqual(rules(file, text).join(","), expected);
  });
}

test("a bare email or phone reaching a log is reported, and does not block", () => {
  assert.deepEqual(rules("src/app/auth.service.ts", "this.logger.log(`User authenticated: ${email}`);"), ["sink:contact:medium"]);
  assert.deepEqual(blocking(scan("src/app/auth.service.ts", "this.logger.log(`User authenticated: ${email}`);")), []);
});

test("a field named only inside a string literal is not a leak", () => {
  assert.deepEqual(rules("src/main/java/A.java", `log.warn("ssn is required");`), []);
  assert.deepEqual(rules("app/a.ts", `console.error("dateOfBirth must be ISO-8601");`), []);
});

test("masked values do not fire, but an unmasked neighbour on the same line does", () => {
  assert.deepEqual(rules("src/main/java/A.java", `log.info("ssn {}", mask(user.ssn));`), []);
  assert.deepEqual(rules("app/a.ts", `logger.info(redactPan(card.cardNumber), user.dateOfBirth);`), ["sink:dob:medium"]);
});

test("identifier words, not substrings: combine/update/span are not mbi/dob/pan", () => {
  assert.deepEqual(rules("app/a.ts", `console.log(combine(update, span));`), []);
});

test("a commented-out log line is not a sink call", () => {
  assert.deepEqual(rules("app/a.ts", `// console.log(user.ssn)`), []);
  assert.deepEqual(rules("app/a.ts", ` * this.logger.warn(\`Login failed for: \${email}\`);`), [], "JSDoc example");
});

test("type and error names are not values", () => {
  assert.deepEqual(rules("app/mail.ts", `throw new EmailError("send failed", cause);`), []);
  assert.deepEqual(rules("src/main/java/A.java", `log.info("using {}", ssnValidator);`), []);
});

test("a call that spans lines is read as one statement", () => {
  const lines: AddedLine[] = [
    { file: "src/main/java/A.java", line: 10, text: `log.info(` },
    { file: "src/main/java/A.java", line: 11, text: `    "visit {}",` },
    { file: "src/main/java/A.java", line: 12, text: `    patient.getMrn());` },
  ];
  assert.deepEqual(scanLines(lines, ALL).map((f) => `${f.rule}@${f.line}`), ["sink:medical-id@10"]);
});

// ── Profile scoping ────────────────────────────────────────────────────────────────────────────
test("the profile decides which data classes are scanned", () => {
  const ccpa = classesFor(["us-state-privacy", "soc2"]);
  assert.deepEqual(rules("src/main/java/A.java", `log.info("${VISA}");`, ccpa), [], "card data is out of scope for CCPA-only");
  assert.deepEqual(rules("app/a.ts", `console.log(member.mrn)`, ccpa), [], "medical IDs are PHI, not in a CCPA profile");
  assert.deepEqual(rules("app/a.ts", `console.log(user.ssn)`, ccpa), ["sink:ssn:high"], "SSNs are CA personal information");
  assert.deepEqual([...classesFor(null)], ["phi-pii"], "no profile = strict PHI/PII default");
});

test("parseFamilies reads both list forms and refuses what it cannot read", () => {
  assert.deepEqual(parseFamilies("version: 1\nfamilies: [hipaa, soc2]\n"), ["hipaa", "soc2"]);
  assert.deepEqual(parseFamilies("version: 1\nfamilies:\n  - pci-dss # payments\n  - soc2\napplicability:\n  - x\n"), ["pci-dss", "soc2"]);
  assert.throws(() => parseFamilies("version: 1\n"), /no families/);
  assert.throws(() => parseFamilies("families: [hipaa,\n  soc2]\n"), /not closed/);
});

test("every committed example profile parses to the same families as a real YAML parser", () => {
  const dir = join(import.meta.dirname, "..", "controls", "examples");
  for (const name of ["opuspopuli.compliance-profile.yaml", "hipaa-gxp.compliance-profile.yaml", "payments.compliance-profile.yaml"]) {
    const text = readFileSync(join(dir, name), "utf8");
    assert.deepEqual(parseFamilies(text), (parse(text) as { families: string[] }).families, name);
  }
});

test("FAMILY_CLASSES mirrors the registry's data_classes exactly", () => {
  const reg = parse(readFileSync(join(import.meta.dirname, "..", "controls", "registry.yaml"), "utf8")) as {
    frameworks: Record<string, { data_classes?: string[] }>;
  };
  const fromRegistry = Object.fromEntries(
    Object.entries(reg.frameworks).filter(([, v]) => (v.data_classes ?? []).length > 0).map(([k, v]) => [k, v.data_classes]),
  );
  assert.deepEqual(FAMILY_CLASSES, fromRegistry);
});

// ── Allowlist ──────────────────────────────────────────────────────────────────────────────────
test("an allowlist entry needs a reason, and suppresses only what it names", () => {
  const allow = parseAllowlist(`# accepted findings\n- path: src/test/resources/**\n  rule: pan\n  reason: Processor sandbox cards from the vendor docs\n`);
  assert.equal(allow.length, 1);
  const lines: AddedLine[] = [
    { file: "src/test/resources/cards/visa.json", line: 1, text: `{"n": "${VISA}"}` },
    { file: "src/test/resources/cards/visa.json", line: 2, text: `{"ssn": "512-44-9081"}` },
  ];
  assert.deepEqual(scanLines(lines, ALL, allow).map((f) => f.rule), ["ssn"]);
  assert.throws(() => parseAllowlist(`- path: a.ts\n  rule: pan\n`), /no reason/);
  assert.throws(() => parseAllowlist(`path a.ts`), /cannot parse/);
});

test("globs: ** crosses directories, * does not", () => {
  assert.ok(globToRegExp("src/test/**").test("src/test/a/b/c.json"));
  assert.ok(globToRegExp("src/*.ts").test("src/a.ts"));
  assert.ok(!globToRegExp("src/*.ts").test("src/a/b.ts"));
});

// ── Plumbing ───────────────────────────────────────────────────────────────────────────────────
test("parseDiff keeps added lines with their new line numbers and skips deletions", () => {
  const diff = [
    "diff --git a/A.java b/A.java",
    "--- a/A.java",
    "+++ b/A.java",
    "@@ -10,0 +11,2 @@ class A {",
    "+  int x = 1;",
    `+  log.info("${VISA}");`,
    "diff --git a/gone.ts b/gone.ts",
    "--- a/gone.ts",
    "+++ /dev/null",
    "@@ -1 +0,0 @@",
    "-console.log(user.ssn)",
  ].join("\n");
  assert.deepEqual(parseDiff(diff), [
    { file: "A.java", line: 11, text: "  int x = 1;" },
    { file: "A.java", line: 12, text: `  log.info("${VISA}");` },
  ]);
});

test("lockfiles, minified bundles and build output are skipped", () => {
  assert.deepEqual(rules("pnpm-lock.yaml", `  ssn: 512-44-9081`), []);
  assert.deepEqual(rules("target/classes/A.java", `log.info("${VISA}")`), []);
});

test("locations from paths, across ecosystems", () => {
  assert.equal(locationOf("src/test/java/com/acme/PayTest.java"), "fixture");
  assert.equal(locationOf("src/app/pay.component.spec.ts"), "fixture");
  assert.equal(locationOf("tests/test_claims.py"), "fixture");
  assert.equal(locationOf("supabase/seed.sql"), "seed");
  assert.equal(locationOf("db/seeds/members.json"), "seed");
  assert.equal(locationOf("README.md"), "docs");
  assert.equal(locationOf("src/main/java/Pay.java"), "code");
});

test("findings never re-leak the value they found", () => {
  const [f] = scan("src/main/java/Pay.java", `log.info("${VISA}");`);
  assert.equal(f.excerpt, "************1486");
  assert.ok(!JSON.stringify(f).includes(VISA));
});

test("an unknown-language file still gets the generic sink rule", () => {
  assert.equal(sinkOf("scripts/run.rb", `logger.info(user.ssn)`), "log");
  assert.equal(sinkOf("x.java", `int count = 0;`), null);
});

test("Amex numbers are 15 digits", () => {
  assert.equal(luhn(AMEX), true);
  assert.deepEqual(rules("app/a.ts", `const c = "${AMEX}";`), ["pan:high"]);
});

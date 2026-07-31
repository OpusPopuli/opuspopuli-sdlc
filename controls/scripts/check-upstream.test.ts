import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "./registry.ts";
import {
  sourceKeyFor,
  pinnableSources,
  manualSources,
  isManualDocument,
  affectedControls,
  ecfrDrifted,
  documentDrifted,
  fedregDrifted,
  driftIssueTitle,
  driftIssueBody,
  selectNewIssues,
  collect,
  DRIFT_LABEL,
  type Fetchers,
  type DriftFinding,
} from "./check-upstream.ts";

const reg = loadRegistry();

test("only pinned ecfr/document/fedreg citations are polled", () => {
  const sources = pinnableSources(reg);
  assert.ok(sources.length > 0);
  assert.ok(sources.every((s) => ["ecfr", "document", "fedreg"].includes(s.adapter)));
  // clause (SOC 2 CC8.1) and any unpinned/eurlex citations are excluded.
  assert.ok(!sources.some((s) => s.key.startsWith("clause")));
});

test("the FDA PDF (auto_poll:false) is excluded from polling and listed as manual", () => {
  // It blocks datacenter IPs, so it must not be fetched by the watcher.
  const polledUrls = pinnableSources(reg).map((s) => s.key);
  assert.ok(!polledUrls.some((k) => k.includes("fda.gov/media/188844")));
  assert.ok(manualSources(reg).some((label) => /Computer Software Assurance/.test(label)));
});

test("the FDA CSA guidance is instead watched via its Federal Register docket", () => {
  assert.ok(pinnableSources(reg).some((s) => s.key === "fedreg:FDA-2022-D-0795"));
});

test("isManualDocument only flags auto_poll:false document citations", () => {
  assert.equal(isManualDocument({ adapter: "document", url: "x", auto_poll: false } as never), true);
  assert.equal(isManualDocument({ adapter: "document", url: "x" } as never), false);
  assert.equal(isManualDocument({ adapter: "ecfr" } as never), false);
});

test("fedreg drift is a change in the newest document number", () => {
  assert.equal(fedregDrifted("2025-18468", "2025-18468"), false);
  assert.equal(fedregDrifted("2025-18468", "2026-99999"), true);
});

test("a source shared by multiple controls is polled once but maps to all of them", () => {
  // §1798.140 backs both CTL-CCPA-001 and CTL-CCPA-004.
  const key = "document:https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140";
  const controls = affectedControls(reg, key);
  assert.ok(controls.includes("CTL-CCPA-001"));
  assert.ok(controls.includes("CTL-CCPA-004"));
  // deduped to a single source entry
  assert.equal(pinnableSources(reg).filter((s) => s.key === key).length, 1);
});

test("ecfr drift is a strictly newer amendment date", () => {
  assert.equal(ecfrDrifted("2016-12-30", "2024-06-25"), true);
  assert.equal(ecfrDrifted("2016-12-30", "2016-12-30"), false);
  assert.equal(ecfrDrifted("2024-06-25", "2016-12-30"), false); // never goes backwards
});

test("document drift is any checksum change", () => {
  assert.equal(documentDrifted("abc", "abc"), false);
  assert.equal(documentDrifted("abc", "def"), true);
});

test("issue title is stable per source (dedup key); body names old/new and controls", () => {
  const f: DriftFinding = {
    key: "ecfr:title-45-part-164-164.312", label: "45 CFR 164.312", adapter: "ecfr",
    oldValue: "2016-12-30", newValue: "2027-01-01", controlIds: ["CTL-HIPAA-001", "CTL-HIPAA-003"], url: "https://example",
  };
  assert.equal(driftIssueTitle(f), "Upstream drift: 45 CFR 164.312");
  const body = driftIssueBody(f);
  assert.match(body, /2016-12-30/);
  assert.match(body, /2027-01-01/);
  assert.match(body, /CTL-HIPAA-001, CTL-HIPAA-003/);
  assert.match(body, /does not re-pin automatically/);
});

test("selectNewIssues skips a source whose issue is already open", () => {
  const f: DriftFinding = { key: "k", label: "45 CFR 164.312", adapter: "ecfr", oldValue: "a", newValue: "b", controlIds: ["X"], url: "u" };
  const open = new Set(["Upstream drift: 45 CFR 164.312"]);
  assert.deepEqual(selectNewIssues([f], [], open), []);
  assert.equal(selectNewIssues([f], [], new Set()).length, 1);
});

test("errors produce a single watcher-broken issue, deduped", () => {
  const errs = [{ key: "k", label: "45 CFR 164.312", message: "HTTP 503" }];
  const specs = selectNewIssues([], errs, new Set());
  assert.equal(specs.length, 1);
  assert.match(specs[0].title, /watcher: check failed/);
  assert.deepEqual(specs[0].labels, [DRIFT_LABEL]);
  // deduped when already open
  assert.deepEqual(selectNewIssues([], errs, new Set([specs[0].title])), []);
});

test("collect reports no drift when live values equal the pins (injected fetchers)", async () => {
  // Echo back each source's pinned value so nothing looks drifted.
  const fetchers: Fetchers = {
    ecfr: async (c) => (c.pinned as { amendment_date: string }).amendment_date,
    document: async (c) => (c.pinned as { sha256: string }).sha256,
    fedreg: async (c) => (c.pinned as { latest_document_number: string }).latest_document_number,
  };
  const { findings, errors } = await collect(reg, fetchers);
  assert.deepEqual(findings, []);
  assert.deepEqual(errors, []);
});

test("collect flags drift and records affected controls (injected fetchers)", async () => {
  const fetchers: Fetchers = {
    ecfr: async () => "2099-01-01", // everything looks newer
    document: async () => "deadbeef", // every checksum differs
    fedreg: async () => "2099-00001", // a newer FR document
  };
  const { findings } = await collect(reg, fetchers);
  assert.ok(findings.length > 0);
  for (const f of findings) assert.ok(f.controlIds.length > 0);
  assert.ok(findings.some((f) => f.adapter === "fedreg"), "fedreg drift is detected");
});

test("retrying preserves every fetcher key (guards the dropped-adapter bug class)", async () => {
  const { retrying } = await import("./check-upstream.ts");
  const stub: Fetchers = { ecfr: async () => "a", document: async () => "b", fedreg: async () => "c" };
  const wrapped = retrying(stub, 1);
  assert.deepEqual(Object.keys(wrapped).sort(), ["document", "ecfr", "fedreg"]);
  assert.equal(await wrapped.fedreg({} as never), "c");
});

test("retrying retries a transient failure then succeeds", async () => {
  const { retrying } = await import("./check-upstream.ts");
  let calls = 0;
  const stub: Fetchers = {
    ecfr: async () => { calls++; if (calls < 2) throw new Error("flake"); return "ok"; },
    document: async () => "b",
    fedreg: async () => "c",
  };
  assert.equal(await retrying(stub, 3).ecfr({} as never), "ok");
  assert.equal(calls, 2);
});

test("a fetch that throws becomes a watcher error, not a crash", async () => {
  const fetchers: Fetchers = {
    ecfr: async () => { throw new Error("boom"); },
    document: async () => { throw new Error("boom"); },
    fedreg: async () => { throw new Error("boom"); },
  };
  const { findings, errors } = await collect(reg, fetchers);
  assert.deepEqual(findings, []);
  assert.ok(errors.length > 0);
  assert.match(errors[0].message, /boom/);
});

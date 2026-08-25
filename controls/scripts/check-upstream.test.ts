import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRegistry, type Registry } from "./registry.ts";
import {
  daysBetween,
  pinOverdue,
  staleManualFindings,
  assertionFailures,
  ecfrDriftDirection,
  unverifiedPins,
  watcherBrokenIssue,
  supersededIssueDates,
  issuedDateVariants,
  assertedDocuments,
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

test("ecfr drift is ANY disagreement with the source, in either direction (#51)", () => {
  assert.equal(ecfrDrifted("2016-12-30", "2024-06-25"), true); // source moved on
  assert.equal(ecfrDrifted("2016-12-30", "2016-12-30"), false); // agrees
  // Previously false ("never goes backwards"). A pin AHEAD of the source is a direction eCFR cannot
  // produce, so it means the pin is wrong — and it compared clean forever.
  assert.equal(ecfrDrifted("2024-06-25", "2016-12-30"), true);
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

// --- pin staleness (#41) ---------------------------------------------------
//
// The defect these guard: auto_poll:false made a source invisible rather than merely unpolled, so a
// mislabelled CTL-CSA-001 pin survived eight clean weekly runs.

function manualRegistry(retrieved: string, reverify_days?: number): Registry {
  return {
    version: 1,
    preamble: { intended_use: "x" },
    profiles: { families: ["gxp-csa"] },
    frameworks: { "gxp-csa": { label: "GxP", sort: 1 } },
    controls: [
      {
        id: "CTL-TEST-001",
        title: "t",
        family: "gxp-csa",
        jurisdiction: "us",
        applicability: ["all"],
        citations: [
          {
            adapter: "document",
            name: "A host-blocked guidance PDF",
            url: "https://example.gov/doc.pdf",
            auto_poll: false,
            ...(reverify_days ? { reverify_days } : {}),
            pinned: { sha256: "abc", retrieved },
          } as never,
        ],
        implemented_by: [{ type: "skill", ref: "op-validate" }],
        evidence: [],
        status: "active",
      },
    ],
  } as Registry;
}

test("daysBetween counts whole days between ISO dates", () => {
  assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
  assert.equal(daysBetween("2026-01-01", "2026-01-31"), 30);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1); // 2026 is not a leap year
});

test("a pin is overdue only once it passes its re-verification window", () => {
  const c = { reverify_days: 90, pinned: { retrieved: "2026-01-01" } } as never;
  assert.equal(pinOverdue(c, "2026-03-31"), false); // 89 days
  assert.equal(pinOverdue(c, "2026-04-01"), false); // exactly 90 — still inside
  assert.equal(pinOverdue(c, "2026-04-02"), true); // 91 — overdue
});

test("a manual source with no reverify_days never ages out (back-compat, and the old bug)", () => {
  const c = { pinned: { retrieved: "2020-01-01" } } as never;
  assert.equal(pinOverdue(c, "2026-08-24"), false);
  assert.deepEqual(staleManualFindings(manualRegistry("2020-01-01"), "2026-08-24"), []);
});

test("an overdue manual pin becomes a stale-pin drift finding naming its controls", () => {
  const findings = staleManualFindings(manualRegistry("2026-01-01", 90), "2026-08-24");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "stale-pin");
  assert.deepEqual(findings[0].controlIds, ["CTL-TEST-001"]);
  assert.match(findings[0].oldValue, /last verified 2026-01-01/);
});

test("a stale-pin issue is titled distinctly so it can't dedup against a value-drift issue", () => {
  const [stale] = staleManualFindings(manualRegistry("2026-01-01", 90), "2026-08-24");
  const value = { ...stale, kind: "value" as const };
  assert.notEqual(driftIssueTitle(stale), driftIssueTitle(value));
  assert.match(driftIssueTitle(stale), /re-verification overdue/);
  const body = driftIssueBody(stale);
  assert.match(body, /nobody has looked/);
  assert.match(body, /--include-manual/);
  assert.match(body, /Do not clear this by widening/);
});

// --- pin assertions (#41) --------------------------------------------------
//
// The deeper defect: a sha256 proves immutability, not accuracy. Nothing checked that a pin's
// human-written title/date matched the bytes it pinned.

test("issue-date variants cover the ISO and US-guidance spellings", () => {
  const v = issuedDateVariants("2026-02-02");
  assert.ok(v.includes("2026-02-02"));
  assert.ok(v.includes("February 2, 2026"));
});

test("assertions pass when the document text corroborates title and issue date", () => {
  const text =
    "Contains Nonbinding Recommendations Computer Software Assurance for Production and Quality " +
    "Management System Software Guidance for Industry Document issued on February 2, 2026.";
  const failures = assertionFailures(
    { title: "Computer Software Assurance for Production and Quality Management System Software", issued: "2026-02-02" },
    text
  );
  assert.deepEqual(failures, []);
});

test("assertions catch the exact CTL-CSA-001 defect: right bytes, superseded label", () => {
  // The Feb 2026 document's real text, checked against the Sept 2025 claim the registry used to make.
  const febText = "Computer Software Assurance for Production and Quality Management System Software. " +
    "Document issued on February 2, 2026. This document supersedes Computer Software Assurance for " +
    "Production and Quality System Software, issued September 24, 2025.";
  const failures = assertionFailures({ title: "Computer Software Assurance for Production and Quality System Software", issued: "2025-09-24" }, febText);
  // The superseded title is a substring of the current one, so the title alone cannot catch it. Nor
  // can plain date containment: the revision quotes the superseded date in its own supersession
  // clause. Only reading that clause as a NEGATIVE signal catches this. That asymmetry is the point.
  assert.equal(failures.length, 1);
  assert.match(failures[0], /SUPERSEDES/);
});

test("assertion checking ignores case, punctuation and whitespace churn", () => {
  const failures = assertionFailures(
    { title: "Computer  Software   Assurance" },
    "computer\nsoftware\tassurance — for production",
  );
  assert.deepEqual(failures, []);
});

test("a wrong title is reported as a mismatch", () => {
  const failures = assertionFailures({ title: "Some Other Guidance" }, "Computer Software Assurance");
  assert.equal(failures.length, 1);
  assert.match(failures[0], /does not contain the asserted title/);
});

test("assertion issue body explains immutability-vs-accuracy, not just the diff", () => {
  const f: DriftFinding = {
    key: "document:https://x", label: "FDA guidance", adapter: "document",
    oldValue: '{"issued":"2025-09-24"}', newValue: "date not found", controlIds: ["CTL-CSA-001"],
    url: "https://x", kind: "assertion",
  };
  assert.match(driftIssueTitle(f), /assertion mismatch/);
  assert.match(driftIssueBody(f), /bytes have not changed since they were pinned/);
  assert.match(driftIssueBody(f), /#41/);
});

// --- registry regression guards (#41) --------------------------------------

test("CTL-CSA-001 asserts the Feb 2026 guidance, not the superseded Sept 2025 one", () => {
  const csa = reg.controls.find((c) => c.id === "CTL-CSA-001")!;
  const doc = csa.citations.find((c) => c.adapter === "document") as never as {
    name: string; asserts?: { title?: string; issued?: string }; reverify_days?: number;
  };
  assert.match(doc.name, /Quality Management System Software/);
  assert.equal(doc.asserts?.issued, "2026-02-02");
  assert.match(String(doc.asserts?.title), /Quality Management System Software/);
  // and it is on a clock, so it can never go invisible again
  assert.ok((doc.reverify_days ?? 0) > 0, "a manual source must carry reverify_days");
});

test("every auto_poll:false citation carries reverify_days", () => {
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (!isManualDocument(c)) continue;
      assert.ok(
        typeof c.reverify_days === "number" && c.reverify_days > 0,
        `${control.id}: auto_poll:false without reverify_days would be invisible forever`
      );
    }
  }
});

test("CTL-CSA-001 cites the amended Part 820 (QMSR) the Feb 2026 guidance is written against", () => {
  const csa = reg.controls.find((c) => c.id === "CTL-CSA-001")!;
  assert.ok(csa.citations.some((c) => c.adapter === "ecfr" && String(c.cfr_part) === "820"));
});

test("assertedDocuments finds every document citation carrying asserts", () => {
  const keys = assertedDocuments(reg).map((s) => s.key);
  assert.ok(keys.some((k) => k.includes("fda.gov/media/188844")));
});

test("retrying preserves a newly-added fetcher key (the dropped-adapter bug class)", async () => {
  const { retrying } = await import("./check-upstream.ts");
  const stub = {
    ecfr: async () => "a", document: async () => "b", fedreg: async () => "c",
    documentText: async () => "text",
  } as never as Fetchers;
  const wrapped = retrying(stub, 1);
  assert.deepEqual(Object.keys(wrapped).sort(), ["document", "documentText", "ecfr", "fedreg"]);
  assert.equal(await wrapped.documentText!({} as never), "text");
});

test("supersededIssueDates reads the supersession clause, not every date in the document", () => {
  const text = "Document issued on February 2, 2026. This document supersedes Computer Software " +
    "Assurance for Production and Quality System Software, issued September 24, 2025. Contact us in 2027.";
  const dates = supersededIssueDates(text);
  assert.deepEqual(dates, ["September 24, 2025"]);
  // the current issue date is NOT treated as superseded
  assert.ok(!dates.includes("February 2, 2026"));
});

test("the corrected Feb 2026 assertion passes against the same text that fails the old one", () => {
  const febText = "Computer Software Assurance for Production and Quality Management System Software. " +
    "Document issued on February 2, 2026. This document supersedes Computer Software Assurance for " +
    "Production and Quality System Software, issued September 24, 2025.";
  assert.deepEqual(
    assertionFailures(
      { title: "Computer Software Assurance for Production and Quality Management System Software", issued: "2026-02-02" },
      febText
    ),
    []
  );
});

// --- statute version assertions (#43) --------------------------------------
//
// A statute's enactment line is version-specific by construction, so it cannot pass vacuously the
// way a generic title can. These guard the CCPA backfill.

test("a matching version assertion passes", () => {
  const text = "…the consumer’s personal information. (Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824) Effective January 1, 2025.)";
  assert.deepEqual(
    assertionFailures({ version: "Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824)", issued: "2025-01-01" }, text),
    []
  );
});

test("a superseded enactment line is reported as a mismatch", () => {
  // The section was amended; the registry still claims the prior chapter/bill.
  const text = "(Amended by Stats. 2025, Ch. 67, Sec. 27. (AB 1170) Effective January 1, 2026.)";
  const failures = assertionFailures({ version: "Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824)" }, text);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /does not contain the asserted version/);
  assert.match(failures[0], /may have been revised/);
});

test("version assertions tolerate punctuation and whitespace churn like the others", () => {
  assert.deepEqual(
    assertionFailures({ version: "Amended by Stats. 2024, Ch. 121, Sec. 6. (AB 3286)" },
      "amended  by stats 2024 ch 121 sec 6 ab 3286 effective january 1 2025"),
    []
  );
});

test("every CTL-CCPA-* document citation carries assertions (#43 backfill)", () => {
  const ccpa = reg.controls.filter((c) => c.id.startsWith("CTL-CCPA-"));
  assert.ok(ccpa.length >= 4);
  for (const control of ccpa) {
    for (const c of control.citations) {
      if (c.adapter !== "document") continue;
      assert.ok(c.asserts, `${control.id}: document citation ${c.url} has no asserts — untested description`);
      const a = c.asserts as { title?: string };
      assert.ok(a.title, `${control.id}: asserts must at minimum identify the document`);
    }
  }
});

test("the two citations sharing § 1798.140 assert the same version (no split-brain)", () => {
  const shared = reg.controls
    .flatMap((c) => c.citations)
    .filter((c) => String(c.url ?? "").includes("sectionNum=1798.140"))
    .map((c) => JSON.stringify(c.asserts));
  assert.equal(shared.length, 2);
  assert.equal(shared[0], shared[1], "CTL-CCPA-001 and CTL-CCPA-004 must not claim different versions of one section");
});

test("statute citations assert an enactment version, not just a title", () => {
  // A title alone ("California Code, CIV 1798.120") survives any amendment — it would pass vacuously.
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (!String(c.url ?? "").includes("leginfo")) continue;
      const a = c.asserts as { version?: string };
      assert.ok(a?.version, `${control.id}: a statute pin needs its enactment line to be falsifiable`);
    }
  }
});

// --- watcher-broken issues name the pins they leave unverified (#42) -------
//
// The causal defect behind #20 -> #21: the watcher reported "this URL 404s" and never named
// CTL-CSA-001, so whoever fixed the fetch had no pointer to the pin underneath.

const FDA_KEY = "document:https://www.fda.gov/media/188844/download";

test("unverifiedPins maps an errored source to the controls that depend on it", () => {
  const rows = unverifiedPins(reg, [{ key: FDA_KEY, label: "FDA guidance", message: "HTTP 404" }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].controlId, "CTL-CSA-001");
  assert.match(rows[0].pinnedValue, /^11e2e21f/);
  assert.equal(rows[0].lastVerified, "2026-08-24");
});

test("an errored source shared by several controls lists every one of them", () => {
  const key = "document:https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140";
  const ids = unverifiedPins(reg, [{ key, label: "§ 1798.140", message: "HTTP 503" }]).map((r) => r.controlId);
  assert.deepEqual(ids, ["CTL-CCPA-001", "CTL-CCPA-004"]);
});

test("regression for #20: a 404 on the FDA source names CTL-CSA-001 in the issue body", () => {
  // The exact scenario that produced #20. Its real body never mentioned the control.
  const spec = watcherBrokenIssue([{ key: FDA_KEY, label: "FDA guidance", message: "HTTP 404" }], reg);
  assert.match(spec.body, /CTL-CSA-001/);
  assert.match(spec.body, /HTTP 404/);
  assert.match(spec.body, /Pins now UNVERIFIED/);
});

test("the issue states that restoring the fetch does not resolve it", () => {
  const spec = watcherBrokenIssue([{ key: FDA_KEY, label: "FDA guidance", message: "HTTP 404" }], reg);
  assert.match(spec.body, /Restoring the fetch does not resolve this issue/);
  assert.match(spec.body, /auto_poll: false/); // silencing the poll is called out as a non-fix
  assert.match(spec.body, /--include-manual/);
  assert.match(spec.body, /--repin/);
});

test("rendering is total: an unmappable or unpinned source degrades, never throws", () => {
  // The watcher must always be able to report its own failure.
  const spec = watcherBrokenIssue([{ key: "document:https://nowhere.example/x", label: "?", message: "boom" }], reg);
  assert.match(spec.body, /no pinned citation could be mapped/);
  const unpinned = {
    ...reg,
    controls: [{ ...reg.controls[0], citations: [{ adapter: "document", url: "https://nowhere.example/x" } as never] }],
  } as Registry;
  const rows = unverifiedPins(unpinned, [{ key: "document:https://nowhere.example/x", label: "?", message: "boom" }]);
  assert.equal(rows[0].pinnedValue, "never pinned");
  assert.equal(rows[0].lastVerified, "never");
});

test("watcherBrokenIssue without a registry still renders (back-compat)", () => {
  const spec = watcherBrokenIssue([{ key: "k", label: "src", message: "HTTP 500" }]);
  assert.match(spec.title, /watcher: check failed/);
  assert.match(spec.body, /HTTP 500/);
  assert.deepEqual(spec.labels, [DRIFT_LABEL]);
});

test("selectNewIssues threads the registry into the watcher-broken body", () => {
  const specs = selectNewIssues([], [{ key: FDA_KEY, label: "FDA guidance", message: "HTTP 404" }], new Set(), reg);
  assert.equal(specs.length, 1);
  assert.match(specs[0].body, /CTL-CSA-001/);
});

// --- drift direction (#51) -------------------------------------------------

test("ecfrDriftDirection names which way the pin and the source disagree", () => {
  assert.equal(ecfrDriftDirection("2016-12-29", "2016-12-29"), "none");
  assert.equal(ecfrDriftDirection("2016-12-29", "2023-03-02"), "source-newer");
  assert.equal(ecfrDriftDirection("2023-03-02", "2016-12-29"), "pin-ahead");
});

test("regression for #51: the near-miss that would have passed green", () => {
  // A report proposed setting §11.10 (pinned 2016-12-29, correct) to 2021-12-03 — which is in fact
  // the amendment date of §11.1, a section this registry does not cite. Under the old comparator
  // (live > pinned) that wrong pin compared clean forever: 2016-12-29 > 2021-12-03 is false.
  assert.equal(ecfrDrifted("2021-12-03", "2016-12-29"), true);
  assert.equal(ecfrDriftDirection("2021-12-03", "2016-12-29"), "pin-ahead");
});

test("a pin-ahead issue says DISAGREES and tells you not to re-pin to match", () => {
  const f: DriftFinding = {
    key: "ecfr:title-21-part-11-11.10", label: "21 CFR 11.10", adapter: "ecfr",
    oldValue: "2021-12-03", newValue: "2016-12-29", controlIds: ["CTL-P11-001"], url: "https://example",
  };
  const body = driftIssueBody(f);
  assert.match(body, /DISAGREES with the authoritative source/);
  assert.match(body, /pin is AHEAD of the source/);
  assert.match(body, /Do not re-pin to match the source until you know why/);
  assert.match(body, /different section/); // names the actual cause
});

test("an ordinary source-newer issue keeps the original framing, with no pin-ahead warning", () => {
  const f: DriftFinding = {
    key: "ecfr:title-21-part-11-11.10", label: "21 CFR 11.10", adapter: "ecfr",
    oldValue: "2016-12-29", newValue: "2027-01-01", controlIds: ["CTL-P11-001"], url: "https://example",
  };
  const body = driftIssueBody(f);
  assert.match(body, /has changed upstream/);
  assert.doesNotMatch(body, /pin is AHEAD/);
  assert.match(body, /does not re-pin automatically/);
});

test("only ecfr gets the direction treatment — document and fedreg already compared both ways", () => {
  const f: DriftFinding = {
    key: "document:https://x", label: "a doc", adapter: "document",
    oldValue: "zzz", newValue: "aaa", controlIds: ["CTL-CCPA-001"], url: "https://x",
  };
  assert.doesNotMatch(driftIssueBody(f), /pin is AHEAD/);
});

test("the committed Part 11 pins agree with eCFR per section (guards the wrong 'fix')", () => {
  // §11.10 and §11.50 each have exactly one eCFR content version, 2016-12-29. §11.1 (2022-02-01) and
  // §11.100 (2023-03-02) have later dates but are NOT cited here. Blanket-replacing would be wrong.
  const pinned = new Set<string>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (c.adapter === "ecfr" && String(c.cfr_part) === "11") {
        pinned.add(`${c.cfr_section}=${(c.pinned as { amendment_date: string }).amendment_date}`);
      }
    }
  }
  assert.deepEqual([...pinned].sort(), ["11.10=2016-12-29", "11.50=2016-12-29"]);
});

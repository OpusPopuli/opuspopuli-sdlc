// Upstream drift watch (#4): compares the live authoritative sources against the committed pins and
// files a triage-ready GitHub issue per changed source. It COMPARES; it never re-pins — a regulation
// change becomes an intake item that flows through the SDLC, not a silent checksum bump.
//
// Usage:
//   node --experimental-strip-types controls/scripts/check-upstream.ts --dry-run   # print, no GitHub
//   node --experimental-strip-types controls/scripts/check-upstream.ts             # file issues (CI)
//
// Reuses ecfrLatestAmendment()/pinDocument() from pin.ts (the same primitives that produced the pins).
// Offline pure functions are unit-tested; the live fetch + GitHub REST run only in the workflow.
import { fileURLToPath } from "node:url";
import { loadRegistry, type Registry, type Citation } from "./registry.ts";
import { ecfrLatestAmendment, pinDocument, fedregLatest, fetchDocumentText } from "./pin.ts";

type PolledAdapter = "ecfr" | "document" | "fedreg";

// What a finding is *about*. "value" = the source changed. "stale-pin" = we haven't looked in too
// long. "assertion" = the bytes don't corroborate what the registry claims they are. The latter two
// exist because CTL-CSA-001 carried a mislabelled pin that no amount of checksum comparison could
// surface — a sha256 proves immutability, not accuracy (#41).
export type FindingKind = "value" | "stale-pin" | "assertion";

export interface PinnableSource {
  key: string; // stable dedup/identity key
  label: string; // human-readable, used in the issue title (stable per source)
  adapter: PolledAdapter;
  citation: Citation;
}

export interface DriftFinding {
  key: string;
  label: string;
  adapter: PolledAdapter;
  oldValue: string;
  newValue: string;
  controlIds: string[];
  url: string;
  kind?: FindingKind; // absent = "value" (the original behaviour)
}

export interface WatcherError {
  key: string;
  label: string;
  message: string;
}

export interface IssueSpec {
  title: string;
  body: string;
  labels: string[];
}

export const DRIFT_LABEL = "upstream-drift";
const WATCHER_BROKEN_TITLE = "Upstream drift watcher: check failed";

// --- source identity -------------------------------------------------------

export function sourceKeyFor(c: Citation): string {
  if (c.adapter === "ecfr") {
    const sec = c.cfr_section ? `-${c.cfr_section}` : "";
    return `ecfr:title-${c.cfr_title}-part-${c.cfr_part}${sec}`;
  }
  if (c.adapter === "fedreg") return `fedreg:${c.docket}`;
  return `document:${c.url}`;
}

export function sourceLabelFor(c: Citation): string {
  if (c.adapter === "ecfr") {
    return c.cfr_section
      ? `${c.cfr_title} CFR ${c.cfr_section}`
      : `${c.cfr_title} CFR part ${c.cfr_part}`;
  }
  if (c.adapter === "fedreg") return String(c.name ?? `FR docket ${c.docket}`);
  return String(c.name ?? c.url);
}

export function sourceUrlFor(c: Citation): string {
  if (c.adapter === "ecfr") {
    return `https://www.ecfr.gov/current/title-${c.cfr_title}/part-${c.cfr_part}`;
  }
  if (c.adapter === "fedreg") {
    return `https://www.federalregister.gov/documents/search?conditions%5Bdocket_id%5D=${c.docket}`;
  }
  return String(c.url);
}

// A document citation the watcher must NOT fetch because the host blocks datacenter IPs.
export function isManualDocument(c: Citation): boolean {
  return c.adapter === "document" && c.auto_poll === false;
}

// Unique pinnable sources the watcher polls. ecfr + fedreg + document(auto_poll!==false). clause is
// copyrighted (never polled); eurlex has no citations yet; document with auto_poll:false is manual.
export function pinnableSources(reg: Registry): PinnableSource[] {
  const byKey = new Map<string, PinnableSource>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      const polled =
        (c.adapter === "ecfr" || c.adapter === "fedreg" || (c.adapter === "document" && !isManualDocument(c))) &&
        "pinned" in c;
      if (polled) {
        const key = sourceKeyFor(c);
        if (!byKey.has(key)) {
          byKey.set(key, { key, label: sourceLabelFor(c), adapter: c.adapter as PolledAdapter, citation: c });
        }
      }
    }
  }
  return [...byKey.values()];
}

// Document sources deliberately excluded from polling (host blocks CI) — surfaced in the summary.
export function manualSources(reg: Registry): string[] {
  const labels = new Set<string>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (isManualDocument(c)) labels.add(sourceLabelFor(c));
    }
  }
  return [...labels];
}

export function affectedControls(reg: Registry, key: string): string[] {
  return reg.controls
    .filter((ctl) => ctl.citations.some((c) => sourceKeyFor(c) === key))
    .map((ctl) => ctl.id);
}

// --- comparison ------------------------------------------------------------

// ISO dates sort lexically; live newer than pinned is drift.
export function ecfrDrifted(pinnedDate: string, liveDate: string): boolean {
  return liveDate > pinnedDate;
}

export function documentDrifted(pinnedSha: string, liveSha: string): boolean {
  return pinnedSha !== liveSha;
}

// A new document on the docket (different newest document number) is a revision to watch.
export function fedregDrifted(pinnedDocNumber: string, liveDocNumber: string): boolean {
  return pinnedDocNumber !== liveDocNumber;
}

// --- pin staleness (#41) ---------------------------------------------------
//
// auto_poll:false excuses a source from *automated* polling; it must not excuse it from being
// checked at all. Without a clock, an unpolled source is invisible forever — which is exactly how
// CTL-CSA-001 sat mislabelled through eight clean weekly runs. `reverify_days` puts it back on one.

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.floor(ms / 86_400_000);
}

export function pinOverdue(c: Citation, today: string): boolean {
  const days = c.reverify_days as number | undefined;
  const retrieved = (c.pinned as { retrieved?: string } | undefined)?.retrieved;
  if (!days || !retrieved) return false;
  return daysBetween(retrieved, today) > days;
}

// Manual (unpolled) sources whose pin has aged past its re-verification window.
export function staleManualFindings(reg: Registry, today: string): DriftFinding[] {
  const byKey = new Map<string, DriftFinding>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (!isManualDocument(c) || !pinOverdue(c, today)) continue;
      const key = sourceKeyFor(c);
      if (byKey.has(key)) continue;
      const retrieved = (c.pinned as { retrieved: string }).retrieved;
      byKey.set(key, {
        key,
        label: sourceLabelFor(c),
        adapter: "document",
        oldValue: `last verified ${retrieved} (${daysBetween(retrieved, today)} days ago)`,
        newValue: `re-verification window is ${c.reverify_days} days`,
        controlIds: affectedControls(reg, key),
        url: sourceUrlFor(c),
        kind: "stale-pin",
      });
    }
  }
  return [...byKey.values()];
}

// --- pin assertions (#41) --------------------------------------------------
//
// `asserts` records what the pinned bytes are CLAIMED to be, in the document's own words. Comparing
// it against text extracted from the fetched document is the only check that can catch a pin whose
// checksum is correct but whose description is not.

export interface PinAssertions {
  title?: string;
  issued?: string;
  // The document's own statement of which version it is. For California statutes this is the
  // enactment line ("Amended by Stats. 2024, Ch. 940, Sec. 1. (AB 1824)") — version-specific by
  // construction, so it cannot pass vacuously the way a generic title can (#43).
  version?: string;
}

// US federal guidance states its date as "February 2, 2026"; accept that, the ISO form, and a
// zero-padded variant, so a correct pin isn't reported as a mismatch over formatting.
export function issuedDateVariants(iso: string): string[] {
  const [y, m, d] = iso.split("-");
  const month = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ][Number(m) - 1];
  const day = String(Number(d));
  return [iso, `${month} ${day}, ${y}`, `${month} ${d}, ${y}`, `${m}/${d}/${y}`].filter(Boolean);
}

function loosen(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Dates a document names as belonging to something it SUPERSEDES. Plain containment is not enough
// to verify an issue date: a revision quotes the date of the version it replaces ("This document
// supersedes …, issued September 24, 2025"), so the superseded date is present in the current text.
// That is precisely the case that fooled CTL-CSA-001, so it gets an explicit check.
export function supersededIssueDates(text: string): string[] {
  const dates: string[] = [];
  for (const clause of text.matchAll(/supersedes\b([\s\S]{0,400}?)(?:\.\s|$)/gi)) {
    for (const d of clause[1].matchAll(/issued\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/g)) {
      dates.push(d[1]);
    }
  }
  return dates;
}

// Returns human-readable mismatch reasons; empty means the text corroborates every assertion.
// An EMPTY `text` means extraction failed — reported by the caller as an error, not as a mismatch,
// because "we couldn't read it" and "it says something else" are different facts.
export function assertionFailures(asserts: PinAssertions, text: string): string[] {
  const hay = loosen(text);
  const failures: string[] = [];
  if (asserts.title && !hay.includes(loosen(asserts.title))) {
    failures.push(`the document text does not contain the asserted title "${asserts.title}"`);
  }
  if (asserts.version && !hay.includes(loosen(asserts.version))) {
    failures.push(
      `the document text does not contain the asserted version "${asserts.version}" — ` +
        `the source may have been revised, or the pin may describe a different version than it covers`
    );
  }
  if (asserts.issued) {
    const variants = issuedDateVariants(asserts.issued).map(loosen);
    const superseded = supersededIssueDates(text).map(loosen);
    if (superseded.some((s) => variants.includes(s))) {
      failures.push(
        `the asserted issue date ${asserts.issued} is named by this document as the date of a version it SUPERSEDES — ` +
          `the pin describes the superseded document, not the one at this URL`
      );
    } else if (!variants.some((v) => hay.includes(v))) {
      failures.push(
        `the document text does not state the asserted issue date ${asserts.issued} ` +
          `(tried: ${issuedDateVariants(asserts.issued).join(", ")})`
      );
    }
  }
  return failures;
}

export function assertionFinding(reg: Registry, c: Citation, failures: string[]): DriftFinding {
  const key = sourceKeyFor(c);
  return {
    key,
    label: sourceLabelFor(c),
    adapter: "document",
    oldValue: JSON.stringify(c.asserts),
    newValue: failures.join("; "),
    controlIds: affectedControls(reg, key),
    url: sourceUrlFor(c),
    kind: "assertion",
  };
}

// --- issue rendering -------------------------------------------------------

// Stable per source AND per finding kind → one open issue per source per concern. A stale pin and a
// value change are different asks of the reader, so they must not dedup against each other.
export function driftIssueTitle(f: DriftFinding): string {
  if (f.kind === "stale-pin") return `Pin re-verification overdue: ${f.label}`;
  if (f.kind === "assertion") return `Pin assertion mismatch: ${f.label}`;
  return `Upstream drift: ${f.label}`;
}

function staleIssueBody(f: DriftFinding): string {
  return [
    `A pinned source that the watcher does **not** poll automatically has passed its re-verification window.`,
    ``,
    `- **Source:** ${f.label} (\`${f.key}\`)`,
    `- **State:** ${f.oldValue}`,
    `- **Policy:** ${f.newValue}`,
    `- **Affected controls:** ${f.controlIds.join(", ")}`,
    `- **Source link:** ${f.url}`,
    ``,
    `This is **not** a report that the source changed — nobody has looked. \`auto_poll: false\` excuses a`,
    `source from automated polling (its host blocks datacenter IPs), never from being checked at all.`,
    ``,
    `To clear it, from a network that can reach the host:`,
    ``,
    `1. \`npm run drift:dry-run -- --include-manual\` — fetches the manual sources, compares their`,
    `   checksums, and verifies each pin's \`asserts\` (title / issue date) against the document text.`,
    `2. If the document is unchanged and its assertions hold, \`npm run pin -- <CTL-ID>\` to refresh`,
    `   \`retrieved\`. If it changed, triage the revision through the lifecycle first.`,
    ``,
    `Do not clear this by widening \`reverify_days\` or hand-editing the pin block.`,
  ].join("\n");
}

function assertionIssueBody(f: DriftFinding): string {
  return [
    `The bytes this pin covers do **not** corroborate what the registry claims they are.`,
    ``,
    `- **Source:** ${f.label} (\`${f.key}\`)`,
    `- **Registry asserts:** \`${f.oldValue}\``,
    `- **Mismatch:** ${f.newValue}`,
    `- **Affected controls:** ${f.controlIds.join(", ")}`,
    `- **Source link:** ${f.url}`,
    ``,
    `A \`sha256\` proves the bytes have not changed since they were pinned. It proves nothing about`,
    `whether they were described correctly at pin time. This check exists because \`CTL-CSA-001\` was`,
    `pinned to the February 2026 FDA CSA guidance while being labelled as the September 2025 guidance`,
    `it superseded — a mislabelling no checksum comparison could ever have surfaced (#41).`,
    ``,
    `Correct the citation's \`name\`/\`note\`/\`asserts\` to match the document, then re-pin.`,
  ].join("\n");
}

export function driftIssueBody(f: DriftFinding): string {
  if (f.kind === "stale-pin") return staleIssueBody(f);
  if (f.kind === "assertion") return assertionIssueBody(f);
  const kind =
    f.adapter === "ecfr" ? "amendment date" : f.adapter === "fedreg" ? "Federal Register document number" : "document checksum";
  return [
    `The pinned authoritative source for this control set has changed upstream.`,
    ``,
    `- **Source:** ${f.label} (\`${f.key}\`)`,
    `- **Pinned ${kind}:** \`${f.oldValue}\``,
    `- **Live ${kind}:** \`${f.newValue}\``,
    `- **Affected controls:** ${f.controlIds.join(", ")}`,
    `- **Source link:** ${f.url}`,
    ``,
    `This issue is intentionally unclassified so \`/op-issue-triage\` picks it up. Triage it, then`,
    `re-pin via \`npm run pin -- <CTL-ID>\` as part of the lifecycle fix once the change is understood.`,
    `The watcher does not re-pin automatically — a regulation change is reviewed, not silently absorbed.`,
  ].join("\n");
}

// --- unverified pins (#42) -------------------------------------------------
//
// A fetch failure is a statement about our EVIDENCE, not just about the network: the pins that source
// backs revert to unverified. Issue #20 said only "this URL 404s" and never named CTL-CSA-001, so
// whoever fixed it had no pointer to the pin underneath — which is how #21 restored the signal, closed
// the issue, and left a mislabelled pin in place for eight more weeks.

export interface UnverifiedPin {
  controlId: string;
  label: string;
  pinnedValue: string;
  lastVerified: string;
}

// Total by construction: a malformed or unpinned citation renders as "never pinned" rather than
// throwing. The watcher must always be able to report its own failure.
function describePin(c: Citation): { value: string; date: string } {
  const p = (c.pinned ?? {}) as Record<string, string | undefined>;
  if (p.sha256) return { value: p.sha256.slice(0, 12) + "…", date: p.retrieved ?? "unknown" };
  if (p.amendment_date) return { value: p.amendment_date, date: p.checked ?? "unknown" };
  if (p.latest_document_number) return { value: p.latest_document_number, date: p.checked ?? "unknown" };
  return { value: "never pinned", date: "never" };
}

export function unverifiedPins(reg: Registry, errors: WatcherError[]): UnverifiedPin[] {
  const keys = new Set(errors.map((e) => e.key));
  const rows: UnverifiedPin[] = [];
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (!keys.has(sourceKeyFor(c))) continue;
      const { value, date } = describePin(c);
      rows.push({ controlId: control.id, label: sourceLabelFor(c), pinnedValue: value, lastVerified: date });
    }
  }
  return rows.sort((a, b) => a.controlId.localeCompare(b.controlId) || a.label.localeCompare(b.label));
}

export function watcherBrokenIssue(errors: WatcherError[], reg?: Registry): IssueSpec {
  const rows = reg ? unverifiedPins(reg, errors) : [];
  const body = [
    `The upstream drift watcher hit errors and could not verify one or more pinned sources.`,
    ``,
    `## What failed`,
    ``,
    ...errors.map((e) => `- **${e.label}** (\`${e.key}\`): ${e.message}`),
    ``,
    `## Pins now UNVERIFIED`,
    ``,
    ...(rows.length > 0
      ? [
          `These controls depend on the sources above. Until someone re-verifies them, their pins are`,
          `**unconfirmed** — not known-good, not known-stale.`,
          ``,
          `| Control | Citation | Pinned value | Last verified |`,
          `|---|---|---|---|`,
          ...rows.map((r) => `| \`${r.controlId}\` | ${r.label} | \`${r.pinnedValue}\` | ${r.lastVerified} |`),
        ]
      : [`_(no pinned citation could be mapped to these sources — check the registry by hand)_`]),
    ``,
    `## What does NOT resolve this`,
    ``,
    `**Restoring the fetch does not resolve this issue, and neither does silencing it.** Turning a`,
    `source's poll off (\`auto_poll: false\`) or substituting a proxy signal changes what is watched; it`,
    `does not tell you whether the pin above is correct.`,
    ``,
    `This is not hypothetical. #20 reported a 404 on the FDA CSA guidance and never named the affected`,
    `control. #21 restored a signal, closed #20, and left \`CTL-CSA-001\` pinned to bytes it described`,
    `incorrectly — for eight more weeks of green runs (#41).`,
    ``,
    `## What does`,
    ``,
    `1. \`npm run drift:dry-run -- --include-manual\` from a network that can reach the host — compares`,
    `   checksums and verifies each pin's \`asserts\` against the document's own text.`,
    `2. If the source is unchanged and its assertions hold, \`npm run pin -- <CTL-ID> --repin\` to refresh`,
    `   the verification date. If it changed, triage the revision through the lifecycle first.`,
    `3. Close only once every row above has been re-verified.`,
  ].join("\n");
  return { title: WATCHER_BROKEN_TITLE, body, labels: [DRIFT_LABEL] };
}

// Dedup: skip any issue whose exact title is already open.
export function selectNewIssues(
  findings: DriftFinding[],
  errors: WatcherError[],
  openTitles: Set<string>,
  reg?: Registry // supplied by main(); optional so existing callers/tests keep working
): IssueSpec[] {
  const specs: IssueSpec[] = [];
  for (const f of findings) {
    const title = driftIssueTitle(f);
    if (!openTitles.has(title)) {
      specs.push({ title, body: driftIssueBody(f), labels: [DRIFT_LABEL] });
    }
  }
  if (errors.length > 0 && !openTitles.has(WATCHER_BROKEN_TITLE)) {
    specs.push(watcherBrokenIssue(errors, reg));
  }
  return specs;
}

// --- live collection (injectable fetchers for tests) -----------------------

export interface Fetchers {
  ecfr: (c: Citation) => Promise<string>;
  document: (c: Citation) => Promise<string>;
  fedreg: (c: Citation) => Promise<string>; // returns the newest document number on the docket
  documentText?: (c: Citation) => Promise<string>; // for verifying `asserts` (#41)
}

const realFetchers: Fetchers = {
  ecfr: (c) => ecfrLatestAmendment(c.cfr_title as number, String(c.cfr_part), c.cfr_section as string | undefined),
  document: (c) => pinDocument(String(c.url), (c.normalization as "raw" | "text") ?? "raw"),
  fedreg: async (c) => (await fedregLatest(String(c.docket))).document_number,
  documentText: (c) => fetchDocumentText(String(c.url), (c.normalization as "raw" | "text") ?? "raw"),
};

// Every document citation carrying `asserts`, deduped by source. Includes manual ones — assertions
// are checked wherever the fetch can actually happen, which for host-blocked sources is a laptop.
export function assertedDocuments(reg: Registry): PinnableSource[] {
  const byKey = new Map<string, PinnableSource>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (c.adapter !== "document" || !c.asserts) continue;
      const key = sourceKeyFor(c);
      if (!byKey.has(key)) byKey.set(key, { key, label: sourceLabelFor(c), adapter: "document", citation: c });
    }
  }
  return [...byKey.values()];
}

// The `--include-manual` pass: fetch the sources CI can't reach, compare their checksums, and verify
// every pin's assertions against the document's own text. Run from a network that can reach the host.
export async function collectManual(
  reg: Registry,
  fetchers: Fetchers = realFetchers
): Promise<{ findings: DriftFinding[]; errors: WatcherError[] }> {
  const findings: DriftFinding[] = [];
  const errors: WatcherError[] = [];
  const seen = new Set<string>();

  const targets = [
    ...pinnableSources(reg).filter((s) => s.adapter === "document"),
    ...assertedDocuments(reg),
    ...manualDocumentSources(reg),
  ];

  for (const src of targets) {
    if (seen.has(src.key)) continue;
    seen.add(src.key);
    const c = src.citation;
    try {
      const pinned = (c.pinned as { sha256?: string } | undefined)?.sha256;
      if (pinned) {
        const live = await fetchers.document(c);
        if (documentDrifted(pinned, live)) {
          findings.push({
            key: src.key, label: src.label, adapter: "document", oldValue: pinned, newValue: live,
            controlIds: affectedControls(reg, src.key), url: sourceUrlFor(c), kind: "value",
          });
          continue; // the bytes moved; assertions describe bytes that no longer exist
        }
      }
      if (c.asserts && fetchers.documentText) {
        const text = await fetchers.documentText(c);
        if (!text) {
          errors.push({ key: src.key, label: src.label, message: "could not extract text — assertions unverified" });
          continue;
        }
        const failures = assertionFailures(c.asserts as PinAssertions, text);
        if (failures.length > 0) findings.push(assertionFinding(reg, c, failures));
      }
    } catch (e) {
      errors.push({ key: src.key, label: src.label, message: (e as Error).message });
    }
  }
  return { findings, errors };
}

function manualDocumentSources(reg: Registry): PinnableSource[] {
  const byKey = new Map<string, PinnableSource>();
  for (const control of reg.controls) {
    for (const c of control.citations) {
      if (!isManualDocument(c)) continue;
      const key = sourceKeyFor(c);
      if (!byKey.has(key)) byKey.set(key, { key, label: sourceLabelFor(c), adapter: "document", citation: c });
    }
  }
  return [...byKey.values()];
}

export async function collect(
  reg: Registry,
  fetchers: Fetchers = realFetchers
): Promise<{ findings: DriftFinding[]; errors: WatcherError[] }> {
  const findings: DriftFinding[] = [];
  const errors: WatcherError[] = [];
  const push = (src: PinnableSource, adapter: PolledAdapter, oldValue: string, newValue: string) =>
    findings.push({ key: src.key, label: src.label, adapter, oldValue, newValue, controlIds: affectedControls(reg, src.key), url: sourceUrlFor(src.citation) });

  for (const src of pinnableSources(reg)) {
    const c = src.citation;
    try {
      if (src.adapter === "ecfr") {
        const pinned = (c.pinned as { amendment_date: string }).amendment_date;
        const live = await fetchers.ecfr(c);
        if (ecfrDrifted(pinned, live)) push(src, "ecfr", pinned, live);
      } else if (src.adapter === "fedreg") {
        const pinned = (c.pinned as { latest_document_number: string }).latest_document_number;
        const live = await fetchers.fedreg(c);
        if (fedregDrifted(pinned, live)) push(src, "fedreg", pinned, live);
      } else {
        const pinned = (c.pinned as { sha256: string }).sha256;
        const live = await fetchers.document(c);
        if (documentDrifted(pinned, live)) push(src, "document", pinned, live);
      }
    } catch (e) {
      errors.push({ key: src.key, label: src.label, message: (e as Error).message });
    }
  }
  return { findings, errors };
}

// --- retry (so one transient flake doesn't file a false "watcher broken" issue) ----

export function retrying(fetchers: Fetchers, attempts = 3): Fetchers {
  const wrap = <T>(fn: (c: Citation) => Promise<T>) => async (c: Citation): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn(c);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  };
  // Mapped over the object's own keys rather than listed by hand: the original bug here was a
  // hand-written literal that silently dropped a newly-added fetcher. Adding one can't regress it now.
  const out: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(fetchers)) {
    out[name] = typeof fn === "function" ? wrap(fn as (c: Citation) => Promise<unknown>) : fn;
  }
  return out as unknown as Fetchers;
}

// --- GitHub REST (thin IO; the decisions above are the tested part) --------

const COPYRIGHTED_NOTE =
  "Note: copyrighted frameworks (GAMP 5, SOC 2 TSC, ISO/IEC) are out of scope for automated polling — " +
  "their text is not fetchable, so new-edition checks are manual.";

async function gh(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

async function openIssueTitles(repo: string, token: string): Promise<Set<string>> {
  const res = await gh(`/repos/${repo}/issues?state=open&labels=${DRIFT_LABEL}&per_page=100`, token);
  if (!res.ok) throw new Error(`GitHub list issues → HTTP ${res.status}`);
  const issues = (await res.json()) as Array<{ title: string }>;
  return new Set(issues.map((i) => i.title));
}

async function ensureLabel(repo: string, token: string): Promise<void> {
  const res = await gh(`/repos/${repo}/labels`, token, {
    method: "POST",
    body: JSON.stringify({ name: DRIFT_LABEL, color: "b60205", description: "Filed by the upstream drift watch (#4)" }),
  });
  // 201 created, or 422 already exists — both fine.
  if (!res.ok && res.status !== 422) throw new Error(`GitHub ensure label → HTTP ${res.status}`);
}

async function createIssue(repo: string, token: string, spec: IssueSpec): Promise<void> {
  const res = await gh(`/repos/${repo}/issues`, token, { method: "POST", body: JSON.stringify(spec) });
  if (!res.ok) throw new Error(`GitHub create issue → HTTP ${res.status}`);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const includeManual = process.argv.includes("--include-manual");
  const reg = loadRegistry();
  const fetchers = retrying(realFetchers);
  const { findings, errors } = await collect(reg, fetchers);

  // Offline: a manual source past its re-verification window is drift in its own right (#41).
  findings.push(...staleManualFindings(reg, todayIso()));

  if (includeManual) {
    const extra = await collectManual(reg, fetchers);
    findings.push(...extra.findings);
    errors.push(...extra.errors);
  }

  console.log(`checked ${pinnableSources(reg).length} pinnable source(s): ${findings.length} drifted, ${errors.length} error(s)`);
  for (const f of findings) console.log(`  ${(f.kind ?? "value").toUpperCase()} ${f.label}: ${f.oldValue} → ${f.newValue} (controls: ${f.controlIds.join(", ")})`);
  for (const e of errors) console.log(`  ERROR ${e.label}: ${e.message}`);
  const manual = manualSources(reg);
  if (manual.length > 0 && !includeManual) {
    console.log(`manual re-verification (host blocks automated access): ${manual.join("; ")}`);
    console.log("  ^ these are NOT checked by this run. They age out via reverify_days and file their own issue.");
    console.log("  Run `npm run drift:dry-run -- --include-manual` from an unblocked network to verify them.");
  }
  console.log(COPYRIGHTED_NOTE);

  if (dryRun) {
    console.log("dry-run: no issues filed");
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.error("GITHUB_TOKEN and GITHUB_REPOSITORY are required (omit them only with --dry-run)");
    process.exit(2);
  }

  const openTitles = await openIssueTitles(repo, token);
  const specs = selectNewIssues(findings, errors, openTitles, reg);
  if (specs.length === 0) {
    console.log("no new issues to file (no drift, or an issue is already open per source)");
    return;
  }
  await ensureLabel(repo, token);
  for (const spec of specs) {
    await createIssue(repo, token, spec);
    console.log(`filed: ${spec.title}`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();

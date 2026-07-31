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
import { ecfrLatestAmendment, pinDocument, fedregLatest } from "./pin.ts";

type PolledAdapter = "ecfr" | "document" | "fedreg";

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

// --- issue rendering -------------------------------------------------------

export function driftIssueTitle(f: DriftFinding): string {
  return `Upstream drift: ${f.label}`; // stable per source → one open issue per source
}

export function driftIssueBody(f: DriftFinding): string {
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

export function watcherBrokenIssue(errors: WatcherError[]): IssueSpec {
  const body = [
    `The upstream drift watcher hit errors and could not verify one or more pinned sources.`,
    `Pins may be stale without a drift issue being filed — investigate.`,
    ``,
    ...errors.map((e) => `- **${e.label}** (\`${e.key}\`): ${e.message}`),
  ].join("\n");
  return { title: WATCHER_BROKEN_TITLE, body, labels: [DRIFT_LABEL] };
}

// Dedup: skip any issue whose exact title is already open.
export function selectNewIssues(
  findings: DriftFinding[],
  errors: WatcherError[],
  openTitles: Set<string>
): IssueSpec[] {
  const specs: IssueSpec[] = [];
  for (const f of findings) {
    const title = driftIssueTitle(f);
    if (!openTitles.has(title)) {
      specs.push({ title, body: driftIssueBody(f), labels: [DRIFT_LABEL] });
    }
  }
  if (errors.length > 0 && !openTitles.has(WATCHER_BROKEN_TITLE)) {
    specs.push(watcherBrokenIssue(errors));
  }
  return specs;
}

// --- live collection (injectable fetchers for tests) -----------------------

export interface Fetchers {
  ecfr: (c: Citation) => Promise<string>;
  document: (c: Citation) => Promise<string>;
  fedreg: (c: Citation) => Promise<string>; // returns the newest document number on the docket
}

const realFetchers: Fetchers = {
  ecfr: (c) => ecfrLatestAmendment(c.cfr_title as number, String(c.cfr_part), c.cfr_section as string | undefined),
  document: (c) => pinDocument(String(c.url), (c.normalization as "raw" | "text") ?? "raw"),
  fedreg: async (c) => (await fedregLatest(String(c.docket))).document_number,
};

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
  return { ecfr: wrap(fetchers.ecfr), document: wrap(fetchers.document), fedreg: wrap(fetchers.fedreg) };
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

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const reg = loadRegistry();
  const { findings, errors } = await collect(reg, retrying(realFetchers));

  console.log(`checked ${pinnableSources(reg).length} pinnable source(s): ${findings.length} drifted, ${errors.length} error(s)`);
  for (const f of findings) console.log(`  DRIFT ${f.label}: ${f.oldValue} → ${f.newValue} (controls: ${f.controlIds.join(", ")})`);
  for (const e of errors) console.log(`  ERROR ${e.label}: ${e.message}`);
  const manual = manualSources(reg);
  if (manual.length > 0) console.log(`manual re-verification (host blocks automated access): ${manual.join("; ")}`);
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
  const specs = selectNewIssues(findings, errors, openTitles);
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

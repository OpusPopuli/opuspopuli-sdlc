// Fills the pin blocks of pinnable citations by fetching authoritative sources.
// Usage: node --experimental-strip-types controls/scripts/pin.ts [--all-pending | CTL-...] [registry.yaml]
//
// Network access required — designed to run on GitHub-hosted runners (workflow_dispatch);
// development sandboxes may have restricted egress, in which case entries stay pin-pending.
// Comments in registry.yaml are preserved (yaml Document API).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { parseDocument, type Document } from "yaml";
import { REGISTRY_PATH, REGISTRY_YAML_OPTIONS } from "./registry.ts";

// text-mode normalization for HTML sources (e.g. statute pages): strip markup and collapse
// whitespace so site-template churn doesn't fire false drift alarms. Checksums the words, not the page.
export function normalizeText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

// Latest amendment date for a CFR part (optionally narrowed to a section) via the eCFR
// Versioner API. Endpoint shape verified at runtime — any surprise throws loudly.
export async function ecfrLatestAmendment(
  cfrTitle: number,
  cfrPart: string,
  cfrSection?: string
): Promise<string> {
  const url = `https://www.ecfr.gov/api/versioner/v1/versions/title-${cfrTitle}.json?part=${cfrPart}`;
  const res = await fetchOk(url);
  const body = (await res.json()) as { content_versions?: Array<{ identifier?: string; amendment_date?: string }> };
  const versions = body.content_versions;
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`eCFR Versioner API returned no content_versions for ${url} — API shape may have changed`);
  }
  const relevant = cfrSection
    ? versions.filter((v) => v.identifier === cfrSection || v.identifier?.startsWith(`${cfrSection}(`))
    : versions;
  const dates = relevant.map((v) => v.amendment_date).filter((d): d is string => !!d);
  if (dates.length === 0) throw new Error(`no amendment dates for ${cfrTitle} CFR ${cfrSection ?? cfrPart}`);
  return dates.sort().at(-1)!;
}

export async function pinDocument(url: string, normalization: "raw" | "text"): Promise<string> {
  const res = await fetchOk(url);
  if (normalization === "text") return sha256Hex(normalizeText(await res.text()));
  return sha256Hex(Buffer.from(await res.arrayBuffer()));
}

// Best-effort text out of a PDF, for verifying a pin's `asserts` against the bytes it pins (#41).
// Inflates FlateDecode content streams and collects PDF literal strings — enough to find a cover-page
// title and issue date in FDA-style guidance PDFs. Deliberately not a general PDF parser: subset fonts
// with custom encodings yield noise, and image-only pages yield nothing. Callers must treat an empty
// or non-corroborating result as "could not verify", never as "verified false" on its own.
export function extractPdfText(buf: Buffer): string {
  const chunks: Buffer[] = [];
  for (const m of buf.toString("latin1").matchAll(/stream\r?\n/g)) {
    const start = m.index! + m[0].length;
    const end = buf.indexOf("endstream", start, "latin1");
    if (end < 0) continue;
    try {
      chunks.push(zlibInflate(buf.subarray(start, end)));
    } catch {
      // not a Flate stream (image, already-plain, or a filter we don't handle) — skip it
    }
  }
  const raw = Buffer.concat(chunks).toString("latin1");
  const literals = raw.match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
  const text = literals.map((s) => s.slice(1, -1)).join("");
  // drop bytes that can't be text so font-subset noise doesn't create phantom matches
  return text.replace(/[^\x20-\x7e]+/g, " ").replace(/\s+/g, " ").trim();
}

function zlibInflate(b: Buffer): Buffer {
  return inflateSync(b);
}

// The text of a document as the assertion checker should see it: markup-stripped for HTML sources,
// extracted for PDFs. Mirrors pinDocument()'s normalization choice so both look at the same artifact.
export async function fetchDocumentText(url: string, normalization: "raw" | "text"): Promise<string> {
  const res = await fetchOk(url);
  if (normalization === "text") return normalizeText(await res.text());
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return extractPdfText(buf);
  return buf.toString("utf8").replace(/\s+/g, " ").trim();
}

// Newest document on a Federal Register docket via the free federalregister.gov API (no key).
// A new document = a guidance revision to watch — the drift signal for sources whose own host
// blocks datacenter IPs. Endpoint shape verified at runtime; any surprise throws loudly.
export async function fedregLatest(
  docket: string
): Promise<{ document_number: string; publication_date: string }> {
  const url =
    `https://www.federalregister.gov/api/v1/documents.json?conditions%5Bdocket_id%5D=${encodeURIComponent(docket)}` +
    `&order=newest&per_page=1&fields%5B%5D=document_number&fields%5B%5D=publication_date`;
  const res = await fetchOk(url);
  const body = (await res.json()) as { results?: Array<{ document_number?: string; publication_date?: string }> };
  const top = body.results?.[0];
  if (!top?.document_number || !top?.publication_date) {
    throw new Error(`Federal Register API returned no documents for docket ${docket} — API shape or docket may have changed`);
  }
  return { document_number: top.document_number, publication_date: top.publication_date };
}

async function pinCitation(citation: any): Promise<void> {
  const adapter = citation.get("adapter");
  if (adapter === "ecfr") {
    const date = await ecfrLatestAmendment(
      citation.get("cfr_title"),
      String(citation.get("cfr_part")),
      citation.get("cfr_section") ?? undefined
    );
    citation.set("pinned", { amendment_date: date, checked: today() });
  } else if (adapter === "document") {
    const sha = await pinDocument(citation.get("url"), citation.get("normalization") ?? "raw");
    citation.set("pinned", { sha256: sha, retrieved: today() });
  } else if (adapter === "fedreg") {
    const latest = await fedregLatest(citation.get("docket"));
    citation.set("pinned", {
      latest_document_number: latest.document_number,
      latest_publication_date: latest.publication_date,
      checked: today(),
    });
  } else if (adapter === "eurlex") {
    throw new Error("eurlex adapter pinning is implemented by the GDPR pack (#7)");
  }
  // clause citations are never pinned — identifiers only.
}

async function main() {
  const args = process.argv.slice(2);
  const allPending = args.includes("--all-pending");
  // Without this, an already-pinned citation is skipped forever — which made the `npm run pin -- <CTL-ID>`
  // re-pin step that the drift watcher's own issue body prescribes a silent no-op (#41). Re-pinning is
  // the remediation path for upstream drift, so it has to actually re-pin. Scoped to an explicit flag so
  // the default (--all-pending, run from CI) still can't overwrite a verified pin by accident.
  const repin = args.includes("--repin");
  const targetId = args.find((a) => a.startsWith("CTL-"));
  const registryPath = args.find((a) => a.endsWith(".yaml")) ?? REGISTRY_PATH;
  if (!allPending && !targetId) {
    console.error("usage: pin.ts (--all-pending | CTL-XXX-000 [--repin]) [registry.yaml]");
    process.exit(2);
  }
  if (repin && !targetId) {
    console.error("--repin requires an explicit CTL-XXX-000 — it overwrites verified pins, so it is never a bulk operation");
    process.exit(2);
  }

  const doc: Document = parseDocument(readFileSync(registryPath, "utf8"));
  const controls = doc.get("controls") as any;
  let pinnedCount = 0;
  const failures: string[] = [];

  for (const control of controls.items) {
    const id = control.get("id");
    if (targetId && id !== targetId) continue;
    if (allPending && control.get("status") !== "pin-pending") continue;

    let allPinned = true;
    for (const citation of (control.get("citations") as any).items) {
      const adapter = citation.get("adapter");
      const pinnable = adapter === "ecfr" || adapter === "document" || adapter === "eurlex" || adapter === "fedreg";
      if (!pinnable) continue;
      if (citation.has("pinned") && !repin) continue;
      try {
        await pinCitation(citation);
        pinnedCount++;
        console.log(`${id}: pinned ${adapter} citation`);
      } catch (e) {
        allPinned = false;
        failures.push(`${id}: ${(e as Error).message}`);
      }
    }
    if (allPinned) control.set("status", "active");
  }

  writeFileSync(registryPath, doc.toString(REGISTRY_YAML_OPTIONS));
  console.log(`${pinnedCount} citation(s) pinned`);
  for (const f of failures) console.error(`failed — ${f}`);
  if (failures.length > 0) process.exit(1);
}

import { fileURLToPath } from "node:url";
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) await main();

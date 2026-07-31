// Fills the pin blocks of pinnable citations by fetching authoritative sources.
// Usage: node --experimental-strip-types controls/scripts/pin.ts [--all-pending | CTL-...] [registry.yaml]
//
// Network access required — designed to run on GitHub-hosted runners (workflow_dispatch);
// development sandboxes may have restricted egress, in which case entries stay pin-pending.
// Comments in registry.yaml are preserved (yaml Document API).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  const targetId = args.find((a) => a.startsWith("CTL-"));
  const registryPath = args.find((a) => a.endsWith(".yaml")) ?? REGISTRY_PATH;
  if (!allPending && !targetId) {
    console.error("usage: pin.ts (--all-pending | CTL-XXX-000) [registry.yaml]");
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
      if (!pinnable || citation.has("pinned")) continue;
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

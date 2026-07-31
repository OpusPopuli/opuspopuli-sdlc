// Shared loader, paths, and types for controls/registry.yaml.
// Used by validate.ts, pin.ts, and generate-docs.ts so the registry's shape is defined once.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const CONTROLS_DIR = join(SCRIPT_DIR, "..");
export const SCHEMA_PATH = join(CONTROLS_DIR, "schema", "registry.schema.json");
export const REGISTRY_PATH = join(CONTROLS_DIR, "registry.yaml");

export type Adapter = "ecfr" | "eurlex" | "document" | "fedreg" | "clause";

export interface Citation {
  adapter: Adapter;
  [key: string]: unknown;
}

export interface Implementation {
  type: "skill" | "hook" | "architecture";
  ref: string;
  note?: string;
}

export interface Control {
  id: string;
  title: string;
  description?: string;
  family: string;
  jurisdiction: string;
  applicability: string[];
  citations: Citation[];
  implemented_by: Implementation[];
  evidence: string[];
  status: "active" | "pin-pending";
}

export interface FrameworkLabel {
  label: string;
  sort: number;
  data_classes?: string[];
}

export interface Registry {
  version: number;
  preamble: { intended_use: string };
  profiles: { families: string[] };
  frameworks: Record<string, FrameworkLabel>;
  controls: Control[];
}

export function loadRegistry(path: string = REGISTRY_PATH): Registry {
  return parse(readFileSync(path, "utf8")) as Registry;
}

// Canonical serialization options for registry.yaml (#14). lineWidth: 0 disables line-wrapping so a
// re-pin — or any edit — produces a minimal diff (only the changed lines) instead of re-flowing
// whole wrapped paragraphs. pin.ts writes with these options; a round-trip test enforces that the
// committed file is already in this form, so scheduled re-pins (#4) stay reviewable.
export const REGISTRY_YAML_OPTIONS = { lineWidth: 0 } as const;

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

export type Adapter = "ecfr" | "eurlex" | "document" | "clause";

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

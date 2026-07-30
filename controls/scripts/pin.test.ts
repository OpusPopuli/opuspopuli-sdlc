// Offline unit tests for pin.ts helpers — no network. Fetch paths are exercised by the CI
// pin job (#4 wires the scheduled re-verification).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, sha256Hex } from "./pin.ts";

test("text normalization strips markup and collapses whitespace", () => {
  const html = `<html><head><style>p { color: red }</style>
    <script>track("visit")</script></head>
    <body><h1>§ 1798.100</h1>\n<p>General   Duties of\tBusinesses</p></body></html>`;
  assert.equal(normalizeText(html), "§ 1798.100 General Duties of Businesses");
});

test("text normalization is stable across template churn", () => {
  const a = `<div class="old-theme"><p>Same statute text.</p></div>`;
  const b = `<section data-v2="true"><span>Same</span> <b>statute</b> text.</section>`;
  assert.equal(sha256Hex(normalizeText(a)), sha256Hex(normalizeText(b)));
});

test("sha256 matches a known vector", () => {
  assert.equal(
    sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

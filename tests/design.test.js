import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("documented color tokens match canonical CSS", () => {
  const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");
  const css = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8",
  );
  const colors = design.split("colors:\n")[1].split("typography:")[0];
  for (const [, key, value] of colors.matchAll(/  ([a-z-]+): "(#[a-f0-9]+)"/g))
    assert.ok(css.includes(`--${key}: ${value};`), key);
});

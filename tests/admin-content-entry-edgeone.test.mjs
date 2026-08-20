import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/admin/content/page.tsx", import.meta.url), "utf8");

test("content publishing index renders the selected event without an EdgeOne-sensitive server redirect", () => {
  assert.match(source, /getContentManagementDataFast\(viewer, target\.id\)/);
  assert.match(source, /getEventManagementDataFast\(viewer, target\.id\)/);
  assert.match(source, /ContentEventWorkspaceClient/);
  assert.doesNotMatch(source, /redirect\(`\/admin\/content\/\$\{target\.id\}`\)/);
});

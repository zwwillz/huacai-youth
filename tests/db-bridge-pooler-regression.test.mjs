import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const bridgeUrl = new URL("../supabase/functions/huacai-db-bridge/index.ts", import.meta.url);

test("Supabase DB bridge uses the dedicated transaction-pooler secret", async () => {
  const code = await readFile(bridgeUrl, "utf8");
  const clientFactory = code.slice(
    code.indexOf("function createDatabaseClient"),
    code.indexOf("async function handleHttpRequest"),
  );

  assert.match(clientFactory, /Deno\.env\.get\("HUACAI_DB_POOL_URL"\)/);
  assert.doesNotMatch(clientFactory, /Deno\.env\.get\("SUPABASE_DB_URL"\)/);
  assert.match(clientFactory, /max: 1/);
  assert.match(clientFactory, /prepare: false/);
});

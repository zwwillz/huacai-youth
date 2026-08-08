import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { createBridgeSqlClient } from "./bridge-client";

export function getSqlClient() {
  return createBridgeSqlClient();
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

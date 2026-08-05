import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("后台数据库尚未配置，请在 EdgeOne Pages 中设置 DATABASE_URL。");
  }
  client ??= postgres(databaseUrl, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return drizzle(client, { schema });
}

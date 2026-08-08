import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("后台数据库尚未配置，请在 EdgeOne Pages 中设置 DATABASE_URL。");
  }

  // EdgeOne can freeze and later resume a warm cloud-function instance.
  // Reusing a module-global Postgres.js client in that environment can reuse
  // a TCP socket that Supavisor or the platform has already discarded. Give
  // each caller a short-lived client instead; the transaction pooler handles
  // server-side reuse without carrying client sockets across invocations.
  return postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 1,
    max_lifetime: 10,
    connection: {
      application_name: "huacai-edgeone",
    },
  });
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("后台数据库尚未配置，请在 EdgeOne Pages 中设置 DATABASE_URL。");
  }
  client ??= postgres(databaseUrl, {
    // EdgeOne Pages scales with short-lived server instances. Keeping a
    // five-connection pool per instance multiplies quickly when several
    // admin routes are requested at once, so each instance deliberately
    // uses one connection and lets Supabase's transaction pooler multiplex.
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 5,
    // Rotate serverless connections promptly and avoid TCP keep-alive timers
    // surviving beyond a short EdgeOne cloud-function invocation.
    max_lifetime: 15,
    keep_alive: null,
    connection: {
      application_name: "huacai-edgeone",
    },
  });
  return client;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

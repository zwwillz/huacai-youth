import { drizzle } from "drizzle-orm/postgres-js";
import { after } from "next/server";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;

function scheduleClientCleanup(currentClient: ReturnType<typeof postgres>) {
  try {
    after(async () => {
      if (client === currentClient) client = null;
      try {
        await currentClient.end({ timeout: 2 });
      } catch (error) {
        console.error("Failed to close the request database client", error);
      }
    });
  } catch {
    // Database scripts and build-time checks do not have a Next.js request
    // lifecycle. Their callers remain responsible for process teardown.
  }
}

export function getSqlClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("后台数据库尚未配置，请在 EdgeOne Pages 中设置 DATABASE_URL。");
  }
  if (client) return client;

  const nextClient = postgres(databaseUrl, {
    // EdgeOne Pages scales with short-lived server instances. Keeping a
    // five-connection pool per instance multiplies quickly when several
    // admin routes are requested at once, so each instance deliberately
    // uses one connection and lets Supabase's transaction pooler multiplex.
    max: 1,
    prepare: false,
    connect_timeout: 8,
    idle_timeout: 5,
    // Rotate connections promptly. Keep Postgres.js TCP keep-alive enabled so
    // a frozen or recycled cloud-function socket is detected instead of being
    // reused by the next authenticated request.
    max_lifetime: 15,
    connection: {
      application_name: "huacai-edgeone",
    },
  });
  client = nextClient;
  scheduleClientCleanup(nextClient);
  return nextClient;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}

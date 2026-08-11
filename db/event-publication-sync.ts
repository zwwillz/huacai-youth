import { sql } from "drizzle-orm";
import { getDb } from "./index";
import { publications } from "./schema";

type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

export async function syncEventOverviewPublicationInTransaction(
  tx: DbTransaction,
  eventId: string,
  published: boolean,
  actorUserId: string | null,
  timestamp: string,
) {
  const status = published ? "published" : "draft";
  await tx.insert(publications).values({
    id: `${eventId}_publication_overview`,
    eventId,
    moduleType: "overview",
    moduleTitle: "赛事概览",
    versionNo: 1,
    status,
    publishedBy: published ? actorUserId : null,
    publishedAt: published ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).onConflictDoUpdate({
    target: [publications.eventId, publications.moduleType],
    set: {
      status,
      versionNo: sql`case when ${publications.status} is distinct from ${status} then ${publications.versionNo}+1 else ${publications.versionNo} end`,
      publishedBy: published ? actorUserId : null,
      publishedAt: published ? timestamp : null,
      updatedAt: timestamp,
    },
  });
}

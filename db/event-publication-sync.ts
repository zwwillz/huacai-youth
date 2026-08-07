import { getSqlClient } from "./index";

export async function syncEventOverviewPublication(eventId: string, published: boolean, actorUserId?: string | null) {
  const sql = getSqlClient();
  const timestamp = new Date().toISOString();
  const id = `${eventId}_publication_overview`;
  await sql`
    insert into public.publications
      (id,event_id,module_type,module_title,version_no,status,published_by,published_at,created_at,updated_at)
    values (${id},${eventId},'overview','赛事概览',1,${published ? "published" : "draft"},${published ? actorUserId ?? null : null},${published ? timestamp : null},${timestamp},${timestamp})
    on conflict (event_id,module_type) do update set
      status=excluded.status,
      version_no=case when public.publications.status is distinct from excluded.status then public.publications.version_no+1 else public.publications.version_no end,
      published_by=excluded.published_by,
      published_at=excluded.published_at,
      updated_at=excluded.updated_at
  `;
}

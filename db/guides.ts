import { eq } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";
import { events } from "./schema";

export type GuideBlock =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; imageUrl: string; caption: string }
  | { id: string; type: "columns"; left: string; right: string };

export type GuideEditorItem = {
  id: string;
  guideType: string;
  title: string;
  publishStatus: "draft" | "published";
  sortOrder: number;
  blocks: GuideBlock[];
};

export type GuideManagementData = {
  event: { id: string; shortTitle: string; city: string };
  guides: GuideEditorItem[];
};

function now() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function requireEditor(username: string, eventId: string, write = false) {
  return requireEventAccess(username, eventId, {
    write,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有编辑参赛提示的权限。",
  });
}

function normalizeBlocks(value: unknown): GuideBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: GuideBlock[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    const id = String(row.id || newId("block"));
    if (row.type === "paragraph") {
      blocks.push({ id, type: "paragraph", text: String(row.text || "") });
      continue;
    }
    if (row.type === "image") {
      blocks.push({ id, type: "image", imageUrl: String(row.imageUrl || ""), caption: String(row.caption || "") });
      continue;
    }
    if (row.type === "columns") {
      blocks.push({ id, type: "columns", left: String(row.left || ""), right: String(row.right || "") });
    }
  }
  return blocks;
}

export async function getGuideManagementData(username: string, eventId: string): Promise<GuideManagementData> {
  await requireEditor(username, eventId);
  const db = getDb();
  const [event] = await db.select({ id: events.id, shortTitle: events.shortTitle, city: events.city }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error("没有找到这场赛事。");

  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; guide_type: string; title: string; publish_status: string; sort_order: number; content_json: unknown; body: string | null }>>`
    select id, guide_type, title, publish_status, sort_order, content_json, body
    from public.event_guides
    where event_id = ${eventId}
    order by sort_order asc, created_at asc
  `;

  const guides = rows.map((row, index) => {
    let blocks = normalizeBlocks(row.content_json);
    if (!blocks.length && row.body) blocks = [{ id: newId("block"), type: "paragraph", text: row.body }];
    return {
      id: row.id,
      guideType: row.guide_type,
      title: row.title,
      publishStatus: row.publish_status === "published" ? "published" as const : "draft" as const,
      sortOrder: row.sort_order ?? index,
      blocks,
    };
  });
  return { event, guides };
}

export async function saveGuideManagementData(username: string, eventId: string, input: GuideEditorItem[]) {
  const account = await requireEditor(username, eventId, true);
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw new Error("没有找到这场赛事。");

  const sql = getSqlClient();
  const updatedAt = now();
  const incomingIds = new Set<string>();
  const current = await sql<Array<{ id: string }>>`select id from public.event_guides where event_id = ${eventId}`;

  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    const title = item.title.trim();
    if (!title) throw new Error(`第 ${index + 1} 条参赛提示缺少标题。`);
    const id = item.id && !item.id.startsWith("draft_") ? item.id : newId("guide");
    incomingIds.add(id);
    const guideType = item.guideType?.trim() || `guide_${id.replace(/^guide_/, "")}`;
    const blocks = normalizeBlocks(item.blocks);
    const fallbackBody = blocks.filter((block) => block.type === "paragraph").map((block) => block.text).filter(Boolean).join("\n\n") || null;
    const publishedAt = item.publishStatus === "published" ? updatedAt : null;
    const contentJson = JSON.stringify(blocks);

    await sql`
      insert into public.event_guides
        (id, event_id, guide_type, title, content_type, body, content_json, sort_order, publish_status, published_at, created_by, created_at, updated_at)
      values
        (${id}, ${eventId}, ${guideType}, ${title}, 'blocks', ${fallbackBody}, ${contentJson}::jsonb, ${index}, ${item.publishStatus}, ${publishedAt}, ${account.id}, ${updatedAt}, ${updatedAt})
      on conflict (event_id, guide_type) do update set
        title = excluded.title,
        content_type = 'blocks',
        body = excluded.body,
        content_json = excluded.content_json,
        sort_order = excluded.sort_order,
        publish_status = excluded.publish_status,
        published_at = case when excluded.publish_status = 'published' then coalesce(public.event_guides.published_at, excluded.published_at) else null end,
        updated_at = excluded.updated_at
    `;
  }

  for (const row of current) {
    if (!incomingIds.has(row.id)) await sql`delete from public.event_guides where id = ${row.id} and event_id = ${eventId}`;
  }

  return getGuideManagementData(username, eventId);
}

export async function getPublicGuide(guideId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ id: string; event_id: string; title: string; content_json: unknown; body: string | null; short_title: string; city: string }>>`
    select g.id, g.event_id, g.title, g.content_json, g.body, e.short_title, e.city
    from public.event_guides g
    join public.events e on e.id = g.event_id
    where g.id = ${guideId}
      and g.publish_status = 'published'
      and e.publish_status = 'published'
      and coalesce(e.is_hidden, false) = false
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  let blocks = normalizeBlocks(row.content_json);
  if (!blocks.length && row.body) blocks = [{ id: newId("block"), type: "paragraph", text: row.body }];
  return { id: row.id, eventId: row.event_id, title: row.title, shortTitle: row.short_title, city: row.city, blocks };
}

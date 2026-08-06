import { and, eq } from "drizzle-orm";
import { getDb, getSqlClient } from "./index";
import { events, users } from "./schema";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function now() {
  return new Date().toISOString();
}

function assetId() {
  return "asset_" + crypto.randomUUID().replaceAll("-", "");
}

async function requireEventEditor(username: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(and(eq(users.username, username), eq(users.status, "active"))).limit(1);
  if (!account || !["system_admin", "committee"].includes(account.role)) {
    throw new Error("当前账号没有上传赛事图片的权限。");
  }
  return account;
}

export type UploadedEventAsset = {
  id: string;
  eventId: string;
  assetType: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  url: string;
};

export async function uploadEventAsset(
  username: string,
  input: {
    eventId: string;
    assetType: string;
    fileName: string;
    mimeType: string;
    bytes: Buffer;
    width?: number | null;
    height?: number | null;
  },
): Promise<UploadedEventAsset> {
  const account = await requireEventEditor(username);
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).limit(1);
  if (!event) throw new Error("没有找到要上传图片的赛事。");
  if (!IMAGE_TYPES.has(input.mimeType)) throw new Error("仅支持 JPG、PNG 或 WebP 图片。");
  if (!input.bytes.length) throw new Error("请选择要上传的图片。");
  if (input.bytes.length > MAX_IMAGE_BYTES) throw new Error("图片不能超过 5MB。");

  const id = assetId();
  const createdAt = now();
  const sql = getSqlClient();
  await sql`
    insert into public.event_assets
      (id, event_id, asset_type, file_name, mime_type, byte_size, width, height, data, created_by, created_at)
    values
      (${id}, ${input.eventId}, ${input.assetType}, ${input.fileName.slice(0, 240)}, ${input.mimeType}, ${input.bytes.length}, ${input.width ?? null}, ${input.height ?? null}, ${input.bytes}, ${account.id}, ${createdAt})
  `;

  const url = `/api/assets/${id}`;
  if (input.assetType === "cover") {
    await db.update(events).set({ coverImageKey: url, updatedBy: account.id, updatedAt: createdAt }).where(eq(events.id, input.eventId));
  }

  return {
    id,
    eventId: input.eventId,
    assetType: input.assetType,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.bytes.length,
    width: input.width ?? null,
    height: input.height ?? null,
    url,
  };
}

export async function readEventAsset(assetId: string) {
  const sql = getSqlClient();
  const rows = await sql<{
    mime_type: string;
    file_name: string;
    data: Buffer;
  }[]>`
    select mime_type, file_name, data
    from public.event_assets
    where id = ${assetId}
    limit 1
  `;
  return rows[0] ?? null;
}

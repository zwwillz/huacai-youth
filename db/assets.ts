import { getSqlClient } from "./index";
import { requireEventAccess } from "./permissions";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;

function now() {
  return new Date().toISOString();
}

function assetId() {
  return "asset_" + crypto.randomUUID().replaceAll("-", "");
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
  const account = await requireEventAccess(username, input.eventId, {
    write: true,
    allowedRoles: ["system_admin", "committee"],
    deniedMessage: "当前账号没有上传赛事文件的权限。",
  });
  if (!input.bytes.length) throw new Error("请选择要上传的文件。");

  const isDocument = input.assetType.startsWith("document_");
  if (isDocument) {
    if (input.mimeType !== "application/pdf") throw new Error("赛事文件目前仅支持 PDF。");
    if (input.bytes.length > MAX_PDF_BYTES) throw new Error("PDF 文件不能超过 15MB。");
  } else {
    if (!IMAGE_TYPES.has(input.mimeType)) throw new Error("图片仅支持 JPG、PNG 或 WebP。");
    if (input.bytes.length > MAX_IMAGE_BYTES) throw new Error("图片不能超过 5MB。");
  }

  const id = assetId();
  const createdAt = now();
  const sql = getSqlClient();
  await sql`
    insert into public.event_assets
      (id, event_id, asset_type, file_name, mime_type, byte_size, width, height, data, created_by, created_at)
    values
      (${id}, ${input.eventId}, ${input.assetType}, ${input.fileName.slice(0, 240)}, ${input.mimeType}, ${input.bytes.length}, ${input.width ?? null}, ${input.height ?? null}, ${input.bytes}, ${account.id}, ${createdAt})
  `;

  return {
    id,
    eventId: input.eventId,
    assetType: input.assetType,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.bytes.length,
    width: input.width ?? null,
    height: input.height ?? null,
    url: `/api/assets/${id}`,
  };
}

export async function readEventAsset(assetId: string) {
  const sql = getSqlClient();
  // Read bytea as base64 text instead of transporting raw binary through the
  // HTTPS database bridge. This is more reliable on Edge runtimes and avoids
  // broken image/PDF responses after a successful upload.
  const rows = await sql<Array<{
    mimeType: string;
    fileName: string;
    dataBase64: string;
  }>>`
    select mime_type as "mimeType", file_name as "fileName", encode(data, 'base64') as "dataBase64"
    from public.event_assets
    where id = ${assetId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    mime_type: row.mimeType,
    file_name: row.fileName,
    data: Buffer.from(row.dataBase64, "base64"),
  };
}

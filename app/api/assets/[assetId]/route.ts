import { readEventAsset } from "@/db/assets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await readEventAsset(assetId);
  if (!asset) return new Response("Not found", { status: 404 });

  // Node's Buffer is not accepted as BodyInit by the DOM types used by
  // Next.js 16. Convert it to a web-compatible Uint8Array first.
  const body = Uint8Array.from(asset.data);

  return new Response(body, {
    headers: {
      "content-type": asset.mime_type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`,
      "content-length": String(body.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

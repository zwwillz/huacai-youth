import { readEventAsset } from "@/db/assets";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await readEventAsset(assetId);
  if (!asset) return new Response("Not found", { status: 404 });

  return new Response(asset.data, {
    headers: {
      "content-type": asset.mime_type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

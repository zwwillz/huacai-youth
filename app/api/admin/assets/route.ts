import { getAdminViewer } from "@/app/admin/admin-viewer";
import { uploadEventAsset } from "@/db/assets";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "请先登录后台。" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    const eventId = String(form.get("eventId") || "").trim();
    const assetType = String(form.get("assetType") || "image").trim();
    const widthValue = Number(form.get("width") || 0);
    const heightValue = Number(form.get("height") || 0);

    if (!eventId) throw new Error("缺少赛事ID。");
    if (!(file instanceof File)) throw new Error("请选择要上传的文件。");

    const bytes = Buffer.from(await file.arrayBuffer());
    const data = await uploadEventAsset(viewer.username, {
      eventId,
      assetType,
      fileName: file.name || "file",
      mimeType: file.type || "application/octet-stream",
      bytes,
      width: widthValue > 0 ? widthValue : null,
      height: heightValue > 0 ? heightValue : null,
    });
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "文件上传失败。" }, { status: 400 });
  }
}

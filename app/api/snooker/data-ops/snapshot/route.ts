import { loadSnookerOpsSnapshot } from "@/lib/snooker/data-ops-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await loadSnookerOpsSnapshot<unknown>();
    return Response.json(snapshot, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "数据运维快照读取失败。";
    const status = message.includes("UNAUTHORIZED") ? 401 : message.includes("PASSWORD_CHANGE_REQUIRED") ? 428 : 500;
    return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

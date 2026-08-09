import { getAdminViewer } from "@/app/admin/admin-viewer";
import { updatePlayerPointsRule } from "@/db/player-points";

export const dynamic = "force-dynamic";

type RulePayload = {
  year?: number;
  participationPoints?: number;
  prizeUnitYuan?: number;
  prizePointsPerUnit?: number;
};

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function PUT(request: Request) {
  const startedAt = performance.now();
  const viewer = await getAdminViewer();
  if (!viewer) return Response.json({ error: "登录状态已失效，请重新登录。" }, { status: 401 });
  if (viewer.role !== "system_admin") return Response.json({ error: "只有系统管理员可以维护积分规则。" }, { status: 403 });

  try {
    const body = await request.json() as RulePayload;
    const year = Math.trunc(number(body.year, new Date().getFullYear()));
    const participationPoints = Math.max(0, Math.trunc(number(body.participationPoints, 1)));
    const prizeUnitYuan = Math.max(1, Math.trunc(number(body.prizeUnitYuan, 100)));
    const prizePointsPerUnit = Math.max(0, Math.trunc(number(body.prizePointsPerUnit, 1)));

    await updatePlayerPointsRule(viewer, { year, participationPoints, prizeUnitYuan, prizePointsPerUnit });

    return Response.json({
      data: { year, participationPoints, prizeUnitYuan, prizePointsPerUnit },
      message: "积分规则已保存，本赛季积分与排名将按新规则重新计算。",
    }, {
      headers: {
        "Cache-Control": "private, no-store",
        "Server-Timing": `app;dur=${(performance.now() - startedAt).toFixed(1)}`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "积分规则保存失败。" }, { status: 500 });
  }
}

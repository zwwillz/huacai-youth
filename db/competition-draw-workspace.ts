import { calculateQualificationPlan, getDrawWorkspaceData, type DrawPhaseCode, type DrawWorkspaceData } from "./draw-engine";
import { getSqlClient } from "./index";

export async function getCompetitionDrawWorkspaceData(
  username: string,
  eventId: string,
  groupId?: string,
  phaseCode: DrawPhaseCode = "qualifier-one",
): Promise<DrawWorkspaceData> {
  const base = await getDrawWorkspaceData(username, eventId, groupId, phaseCode);
  if (!["qualifier-two", "main-one"].includes(phaseCode)) return base;

  const sql = getSqlClient();
  const countRows = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from public.competition_phase_entries
    where event_id=${eventId} and group_id=${base.selectedGroupId} and phase_code=${phaseCode} and status='active'
  `;
  const entrantCount = countRows[0]?.count ?? 0;
  const requiredCount = phaseCode === "main-one" ? 64 : 2;
  if (entrantCount < requiredCount) {
    return {
      ...base,
      plan: {
        ...base.plan,
        entrantCount,
        sourceReady: false,
        sourceNote: phaseCode === "qualifier-two"
          ? "请先在“晋级确认”中确认资格赛第一场晋级名单。系统会自动把第一场未晋级球员生成资格赛第二场参赛名单。"
          : `正赛第一阶段当前已生成 ${entrantCount}/64 人。请先完成两场资格赛晋级确认并确认16名种子参赛。`,
      },
    };
  }

  const plan = calculateQualificationPlan({
    entrantCount,
    bracketSize: base.settings.bracketSize,
    divisionSize: base.settings.divisionSize,
    rateQualifierCount: base.settings.rateQualifierCount,
    phaseCode,
  });
  return {
    ...base,
    plan: {
      ...plan,
      sourceReady: true,
      sourceNote: phaseCode === "qualifier-two"
        ? `资格赛第一场晋级名单已经确认，当前自动生成 ${entrantCount} 名未晋级球员进入资格赛第二场。`
        : `两场资格赛共48名晋级球员 + 16名已确认种子，正赛第一阶段64人名单已经就绪。`,
    },
  };
}

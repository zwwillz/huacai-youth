import { calculateQualificationPlan, getDrawWorkspaceData, type DrawPhaseCode, type DrawWorkspaceData } from "./draw-engine";
import { getSqlClient } from "./index";

export async function getCompetitionDrawWorkspaceData(
  username: string,
  eventId: string,
  groupId?: string,
  phaseCode: DrawPhaseCode = "qualifier-one",
): Promise<DrawWorkspaceData> {
  const base = await getDrawWorkspaceData(username, eventId, groupId, phaseCode);
  if (phaseCode !== "qualifier-two") return base;

  const sql = getSqlClient();
  const countRows = await sql<Array<{ count: number }>>`
    select count(*)::int as count
    from public.competition_phase_entries
    where event_id=${eventId} and group_id=${base.selectedGroupId} and phase_code='qualifier-two' and status='active'
  `;
  const entrantCount = countRows[0]?.count ?? 0;
  if (entrantCount < 2) {
    return {
      ...base,
      plan: {
        ...base.plan,
        entrantCount,
        sourceReady: false,
        sourceNote: "请先在“晋级确认”中确认资格赛第一场晋级名单。系统会自动把第一场未晋级球员生成资格赛第二场参赛名单。",
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
      sourceNote: `资格赛第一场晋级名单已经确认，当前自动生成 ${entrantCount} 名未晋级球员进入资格赛第二场。`,
    },
  };
}

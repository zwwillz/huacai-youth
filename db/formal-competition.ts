import { getSqlClient } from "./index";
import {
  FORMAL_COMPETITION_CONFIRMED_STATUS,
  groupHasFormalCompetitionData,
  groupReadyToStartCompetition,
} from "./formal-competition-policy.mjs";

export type GroupFormalCompetitionState = {
  confirmedDraw: boolean;
  confirmedBracket: boolean;
  confirmedSchedule: boolean;
  confirmedMatchOrResult: boolean;
  confirmedQualification: boolean;
  lockedMainRoster: boolean;
  confirmedAdvancement: boolean;
  rankingData: boolean;
  started: boolean;
};

export async function getGroupFormalCompetitionState(eventId: string, groupId: string): Promise<GroupFormalCompetitionState> {
  const sql = getSqlClient();
  const rows = await sql<Array<Omit<GroupFormalCompetitionState, "started">>>`
    select
      exists(select 1 from public.draw_sessions ds where ds.event_id=${eventId} and ds.group_id=${groupId} and ds.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}) as "confirmedDraw",
      exists(select 1 from public.competition_brackets b where b.event_id=${eventId} and b.group_id=${groupId} and b.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}) as "confirmedBracket",
      exists(select 1 from public.competition_schedules s where s.event_id=${eventId} and s.group_id=${groupId} and s.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}) as "confirmedSchedule",
      exists(select 1 from public.competition_bracket_matches bm where bm.event_id=${eventId} and bm.group_id=${groupId} and (bm.result_status='confirmed' or bm.status in ('completed','auto_advanced'))) as "confirmedMatchOrResult",
      exists(select 1 from public.competition_qualification_batches qb where qb.event_id=${eventId} and qb.group_id=${groupId} and qb.status='confirmed') as "confirmedQualification",
      exists(select 1 from public.competition_main_roster_locks mr where mr.event_id=${eventId} and mr.group_id=${groupId} and mr.status='locked') as "lockedMainRoster",
      exists(select 1 from public.competition_main_advancement_batches ma where ma.event_id=${eventId} and ma.group_id=${groupId} and ma.status='confirmed') as "confirmedAdvancement",
      (
        exists(select 1 from public.competition_final_ranking_batches fr where fr.event_id=${eventId} and fr.group_id=${groupId} and fr.status in ('draft','confirmed','published'))
        or exists(select 1 from public.event_rankings er where er.event_id=${eventId} and er.group_id=${groupId} and er.status in ('draft','confirmed','published'))
      ) as "rankingData"
  `;
  const fact = rows[0] ?? {
    confirmedDraw: false,
    confirmedBracket: false,
    confirmedSchedule: false,
    confirmedMatchOrResult: false,
    confirmedQualification: false,
    lockedMainRoster: false,
    confirmedAdvancement: false,
    rankingData: false,
  };
  return { ...fact, started: groupHasFormalCompetitionData(fact) };
}

export async function hasGroupFormalCompetitionData(eventId: string, groupId: string) {
  return (await getGroupFormalCompetitionState(eventId, groupId)).started;
}

export async function isEventCompetitionReadyToStart(eventId: string) {
  const sql = getSqlClient();
  const rows = await sql<Array<{ rosterLocked: boolean; confirmedDraw: boolean; confirmedBracket: boolean }>>`
    select
      eg.participant_roster_status='locked' as "rosterLocked",
      exists(select 1 from public.draw_sessions ds where ds.event_id=eg.event_id and ds.group_id=eg.id and ds.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}) as "confirmedDraw",
      exists(select 1 from public.competition_brackets b where b.event_id=eg.event_id and b.group_id=eg.id and b.status=${FORMAL_COMPETITION_CONFIRMED_STATUS}) as "confirmedBracket"
    from public.event_groups eg
    where eg.event_id=${eventId} and eg.status='active'
  `;
  return rows.some((row) => groupReadyToStartCompetition(row));
}

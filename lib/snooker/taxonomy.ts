import type {
  SnookerCalendarEvent,
  SnookerEventStage,
  SnookerEventType,
  SnookerPlayerStatus,
  SnookerRankingStatus,
} from "./domain";

export type SnookerEventTaxonomy = {
  eventType: SnookerEventType;
  eventStage: SnookerEventStage;
  rankingStatus: SnookerRankingStatus;
};

export function normalizePlayerStatus(
  value: string | null | undefined,
  isCurrentTour = false,
  turnedPro?: number | null,
): SnookerPlayerStatus {
  if (value === "tour" || value === "former_pro" || value === "amateur" || value === "unknown") return value;
  if (isCurrentTour) return "tour";
  if (turnedPro) return "former_pro";
  return "amateur";
}

export function playerStatusLabel(status: SnookerPlayerStatus) {
  if (status === "tour") return "巡回球员";
  if (status === "former_pro") return "前职业";
  if (status === "amateur") return "业余球员";
  return null;
}

export function normalizeEventTaxonomy(
  eventTypeValue: string | null | undefined,
  eventStageValue: string | null | undefined,
  rankingStatusValue: string | null | undefined,
  legacyTypeZh?: string | null,
): SnookerEventTaxonomy {
  const eventType: SnookerEventType =
    eventTypeValue === "ranking" || eventTypeValue === "invitational" || eventTypeValue === "exhibition" || eventTypeValue === "pro_qualifier"
      ? eventTypeValue
      : legacyTypeZh === "非排名赛"
        ? "invitational"
        : "ranking";

  const eventStage: SnookerEventStage =
    eventStageValue === "main" || eventStageValue === "qualifier" || eventStageValue === "finals"
      ? eventStageValue
      : legacyTypeZh === "资格赛"
        ? "qualifier"
        : "main";

  const rankingStatus: SnookerRankingStatus =
    rankingStatusValue === "ranking" || rankingStatusValue === "non_ranking" || rankingStatusValue === "not_applicable"
      ? rankingStatusValue
      : eventType === "ranking"
        ? "ranking"
        : eventType === "invitational"
          ? "non_ranking"
          : "not_applicable";

  return { eventType, eventStage, rankingStatus };
}

export function compactEventTypeLabel(taxonomy: SnookerEventTaxonomy): SnookerCalendarEvent["typeZh"] {
  if (taxonomy.eventType === "invitational") return "邀请赛";
  if (taxonomy.eventType === "exhibition") return "表演赛";
  if (taxonomy.eventType === "pro_qualifier") return "选拔赛";
  if (taxonomy.eventStage === "qualifier") return "资格赛";
  return "排名赛";
}

export function eventDetailTypeLabel(item: Pick<SnookerCalendarEvent, "typeZh" | "eventType" | "eventStage">) {
  if (item.eventType === "ranking" && item.eventStage === "qualifier") return "排名赛 · 资格赛";
  return item.typeZh;
}

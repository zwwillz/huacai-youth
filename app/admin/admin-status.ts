export const eventStatusLabels: Record<string, string> = {
  draft: "筹备中",
  registration_open: "报名中",
  registration_closed: "报名已截止",
  in_progress: "进行中",
  finished: "已结束",
  archived: "已归档",
};

export function eventStatusLabel(status: string) {
  return eventStatusLabels[status] ?? "状态待确认";
}

export function eventStatusTone(status: string) {
  if (status === "registration_open" || status === "in_progress") return "active";
  if (status === "finished" || status === "archived") return "settled";
  return "pending";
}

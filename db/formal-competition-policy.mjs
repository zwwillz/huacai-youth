export const FORMAL_COMPETITION_CONFIRMED_STATUS = "confirmed";

export function groupReadyToStartCompetition(fact) {
  return Boolean(fact?.rosterLocked && (fact?.confirmedDraw || fact?.confirmedBracket));
}

export function groupHasFormalCompetitionData(fact) {
  return Boolean(
    fact?.confirmedDraw
      || fact?.confirmedBracket
      || fact?.confirmedSchedule
      || fact?.confirmedMatchOrResult
      || fact?.confirmedQualification
      || fact?.lockedMainRoster
      || fact?.confirmedAdvancement
      || fact?.rankingData,
  );
}

export function participantRosterLifecycleDecision(action, eventStatus, groupFormalStarted) {
  const isConfirm = action === "confirm";
  const verb = isConfirm ? "确认" : "锁定";

  if (eventStatus === "registration_open") {
    return { allowed: false, message: `当前赛事仍在报名中，不能${verb}正式参赛名单。请先执行“结束报名”。` };
  }
  if (eventStatus === "registration_closed") return { allowed: true, message: "" };
  if (eventStatus === "in_progress") {
    if (groupFormalStarted) {
      return { allowed: false, message: `当前组已经产生正式竞赛数据，不能再重新${verb}正式参赛名单。` };
    }
    return { allowed: true, message: "" };
  }
  return {
    allowed: false,
    message: isConfirm
      ? "只有赛事处于“报名截止”，或比赛中且当前组尚未进入正式竞赛时，才能确认正式参赛名单。"
      : "只有赛事处于“报名截止”，或比赛中且当前组尚未进入正式竞赛时，才能锁定正式参赛名单。",
  };
}

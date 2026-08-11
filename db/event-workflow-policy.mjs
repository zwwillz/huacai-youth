export const EVENT_LIFECYCLE = ["draft", "registration_open", "registration_closed", "in_progress", "finished", "archived"];

export const LIFECYCLE_LABELS = {
  draft: "筹备中",
  registration_open: "报名中",
  registration_closed: "报名截止",
  in_progress: "比赛中",
  finished: "已结束",
  archived: "已归档",
};

export const LIFECYCLE_PROGRESS = {
  draft: 0,
  registration_open: 1,
  registration_closed: 2,
  in_progress: 4,
  finished: 5,
  archived: 6,
};

const PHASE_LABELS = {
  "qualifier-one": "资格赛第一场",
  "qualifier-two": "资格赛第二场",
  "main-one": "正赛第一阶段",
  "main-two": "正赛第二阶段",
};

function linkAction(code, title, description, href, priority = 60) {
  return { code, title, description, href, priority, kind: "link", lifecycleAction: null };
}
function lifecycleAction(code, title, description, action, priority = 85) {
  return { code, title, description, href: "", priority, kind: "lifecycle", lifecycleAction: action };
}
function waitAction(title, description) {
  return { code: "wait", title, description, href: "", priority: 0, kind: "wait", lifecycleAction: null };
}
function phaseHref(eventId, groupId, phaseCode, tool) {
  const params = new URLSearchParams({ event: eventId, group: groupId, phase: phaseCode });
  return `/admin/competition/${tool}?${params.toString()}`;
}
function participantsHref(eventId, groupId, pending = false) {
  const params = new URLSearchParams({ event: eventId, group: groupId });
  if (pending) params.set("review", "pending");
  return `/admin/participants?${params.toString()}`;
}
function rankingHref(eventId, groupId) {
  return `/admin/competition/final-ranking?event=${encodeURIComponent(eventId)}&group=${encodeURIComponent(groupId)}`;
}

function phaseTask(fact, phaseCode, completionKind) {
  const phase = fact.phases?.[phaseCode] || {};
  const label = PHASE_LABELS[phaseCode] || phaseCode;
  const drawHref = phaseHref(fact.eventId, fact.groupId, phaseCode, "draw");
  if (!phase.drawStatus) {
    return { phase: phaseCode, step: "draw", label: `${label} · 等待抽签`, completedSteps: [], blocker: null,
      nextAction: linkAction(`${phaseCode}_draw`, `开始${fact.groupName}${label}抽签`, `${fact.groupName}前置名单已经就绪，可以建立本阶段正式签表。`, drawHref, 74) };
  }
  if (phase.drawStatus !== "confirmed") {
    return { phase: phaseCode, step: "draw", label: `${label} · 签表待确认`, completedSteps: ["draw_created"], blocker: null,
      nextAction: linkAction(`${phaseCode}_confirm_draw`, `确认${fact.groupName}${label}正式签表`, "当前已经存在抽签草稿，确认后才能进入赛程编排。", drawHref, 76) };
  }
  if (phase.scheduleStatus !== "confirmed") {
    return { phase: phaseCode, step: "schedule", label: `${label} · 赛程编排`, completedSteps: ["draw"], blocker: null,
      nextAction: linkAction(`${phaseCode}_schedule`, `编排${fact.groupName}${label}赛程`, "正式签表已经确认，请完成本阶段排赛。", phaseHref(fact.eventId, fact.groupId, phaseCode, "schedules"), 78) };
  }
  if (Number(phase.pendingResultCount || 0) > 0) {
    return { phase: phaseCode, step: "scoring", label: `${label} · 比赛进行中`, completedSteps: ["draw", "schedule"], blocker: null,
      nextAction: linkAction(`${phaseCode}_scoring`, `${fact.groupName}${label}还有 ${Number(phase.pendingResultCount)} 场比赛待处理`, "请继续录入并确认比赛结果，完成后系统会进入本阶段收尾。", phaseHref(fact.eventId, fact.groupId, phaseCode, "scoring"), 84) };
  }
  if (Number(phase.playableMatchCount || 0) > 0 && Number(phase.confirmedResultCount || 0) < Number(phase.playableMatchCount || 0)) {
    return { phase: phaseCode, step: "scoring", label: `${label} · 比分待确认`, completedSteps: ["draw", "schedule"], blocker: "比赛结果尚未全部确认。",
      nextAction: linkAction(`${phaseCode}_scoring_review`, `复核${fact.groupName}${label}比赛结果`, "赛程已经完成，但仍有比赛结果未形成正式确认状态。", phaseHref(fact.eventId, fact.groupId, phaseCode, "scoring"), 86) };
  }
  if (completionKind === "qualification" && phase.qualificationStatus !== "confirmed") {
    return { phase: phaseCode, step: "advancement", label: `${label} · 晋级确认`, completedSteps: ["draw", "schedule", "scoring"], blocker: null,
      nextAction: linkAction(`${phaseCode}_advancement`, `确认${fact.groupName}${label}晋级名单`, "本阶段比赛已经完成，请确认16名分区冠军和8名局胜率增补，共24人晋级。", phaseHref(fact.eventId, fact.groupId, phaseCode, "qualification"), 82) };
  }
  if (completionKind === "main_advancement" && phase.advancementStatus !== "confirmed") {
    return { phase: phaseCode, step: "advancement", label: `${label} · 32强确认`, completedSteps: ["draw", "schedule", "scoring"], blocker: null,
      nextAction: linkAction("main_one_advancement", `确认${fact.groupName}32强名单`, "正赛第一阶段比赛已经完成，请确认胜部/败部晋级的32强名单。", phaseHref(fact.eventId, fact.groupId, phaseCode, "qualification"), 82) };
  }
  return { phase: phaseCode, step: "complete", label: `${label} · 已完成`, completedSteps: ["draw", "schedule", "scoring", completionKind], blocker: null, nextAction: null };
}

export function buildGroupWorkflow(fact) {
  if (fact.lifecycle === "finished" || fact.lifecycle === "archived") {
    return {
      groupId: fact.groupId, groupName: fact.groupName, groupCode: fact.groupCode,
      roster: { status: fact.rosterStatus, count: Number(fact.rosterCount || 0), pendingCount: Number(fact.pendingCount || 0), approvedCount: Number(fact.approvedCount || 0) },
      competition: { phase: "complete", step: "complete", label: fact.lifecycle === "archived" ? "历史赛事 · 已归档" : "赛事已结束", completedSteps: ["historical_complete"], blocker: null },
      rankingStatus: fact.rankingStatus || "none", nextAction: null,
    };
  }

  const base = {
    groupId: fact.groupId, groupName: fact.groupName, groupCode: fact.groupCode,
    roster: { status: fact.rosterStatus, count: Number(fact.rosterCount || 0), pendingCount: Number(fact.pendingCount || 0), approvedCount: Number(fact.approvedCount || 0) },
  };

  if (Number(fact.pendingCount || 0) > 0 && (fact.lifecycle === "registration_closed" || fact.lifecycle === "in_progress")) {
    const nextAction = linkAction("review_pending", `${fact.groupName}还有 ${Number(fact.pendingCount)} 名报名待审核`, "全部审核完成后才能确认正式参赛名单。", participantsHref(fact.eventId, fact.groupId, true), 92);
    return { ...base, competition: { phase: "roster", step: "waiting", label: "正式名单 · 等待报名审核", completedSteps: [], blocker: nextAction.title }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }
  if (Number(fact.invalidProfileCount || 0) > 0 || Number(fact.unresolvedCount || 0) > 0) {
    const count = Number(fact.invalidProfileCount || 0) + Number(fact.unresolvedCount || 0);
    const nextAction = linkAction("fix_roster_data", `${fact.groupName}有 ${count} 条参赛数据需要处理`, "存在异常审核状态或无效球员档案，请先处理后再推进正式名单。", participantsHref(fact.eventId, fact.groupId), 96);
    return { ...base, competition: { phase: "roster", step: "waiting", label: "正式名单 · 数据异常", completedSteps: [], blocker: nextAction.title }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }
  if (fact.rosterStatus === "confirmed" && Number(fact.rosterCount || 0) !== Number(fact.approvedCount || 0)) {
    const nextAction = linkAction("reconfirm_roster", `${fact.groupName}确认名单与当前审核人数不一致`, "名单确认后报名数据发生变化，请重新检查并确认名单。", participantsHref(fact.eventId, fact.groupId), 98);
    return { ...base, competition: { phase: "roster", step: "waiting", label: "正式名单 · 需要重新确认", completedSteps: [], blocker: nextAction.title }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }

  if (fact.lifecycle !== "registration_closed" && fact.lifecycle !== "in_progress") {
    return { ...base, competition: { phase: "roster", step: "waiting", label: "等待赛事进入报名截止阶段", completedSteps: [], blocker: null }, rankingStatus: fact.rankingStatus || "none", nextAction: null };
  }
  if (fact.rosterStatus === "draft") {
    const nextAction = linkAction("confirm_roster", `确认${fact.groupName}正式参赛名单`, `${fact.groupName}共有 ${Number(fact.approvedCount || 0)} 名审核通过人员，确认后可进入名单锁定。`, participantsHref(fact.eventId, fact.groupId), 72);
    return { ...base, competition: { phase: "roster", step: "confirm", label: "正式名单 · 待确认", completedSteps: [], blocker: null }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }
  if (fact.rosterStatus === "confirmed") {
    const nextAction = linkAction("lock_roster", `锁定${fact.groupName}正式参赛名单`, `已确认 ${Number(fact.rosterCount || 0)} 人，锁定后才能建立资格赛正式竞赛数据。`, participantsHref(fact.eventId, fact.groupId), 73);
    return { ...base, competition: { phase: "roster", step: "lock", label: "正式名单 · 待锁定", completedSteps: ["confirmed"], blocker: null }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }

  const q1 = phaseTask(fact, "qualifier-one", "qualification");
  if (q1.nextAction) return { ...base, competition: q1, rankingStatus: fact.rankingStatus || "none", nextAction: q1.nextAction };
  const q2 = phaseTask(fact, "qualifier-two", "qualification");
  if (q2.nextAction) return { ...base, competition: q2, rankingStatus: fact.rankingStatus || "none", nextAction: q2.nextAction };

  if (fact.mainRosterStatus !== "locked" || Number(fact.mainRosterCount || 0) !== 64 || Number(fact.mainRosterIssueCount || 0) > 0) {
    const issue = Number(fact.mainRosterIssueCount || 0);
    const nextAction = linkAction("main_roster", issue > 0 ? `${fact.groupName}正赛64人名单存在 ${issue} 个问题` : `确认${fact.groupName}正赛64人名单`, issue > 0 ? "请处理种子、递补、重复或资格异常后重新锁定64人名单。" : "两场资格赛已经完成，请完成种子、递补并锁定64人正式名单。", phaseHref(fact.eventId, fact.groupId, "main-one", "qualification"), issue > 0 ? 96 : 78);
    return { ...base, competition: { phase: "main_roster", step: "waiting", label: issue > 0 ? "正赛64人 · 数据异常" : "正赛64人 · 待确认", completedSteps: ["qualifier_one", "qualifier_two"], blocker: issue > 0 ? nextAction.title : null }, rankingStatus: fact.rankingStatus || "none", nextAction };
  }

  const mainOne = phaseTask(fact, "main-one", "main_advancement");
  if (mainOne.nextAction) return { ...base, competition: mainOne, rankingStatus: fact.rankingStatus || "none", nextAction: mainOne.nextAction };
  const mainTwo = phaseTask(fact, "main-two", "matches");
  if (mainTwo.nextAction) return { ...base, competition: mainTwo, rankingStatus: fact.rankingStatus || "none", nextAction: mainTwo.nextAction };

  const rankingStatus = fact.rankingStatus || "none";
  if (rankingStatus === "none") {
    const nextAction = linkAction("generate_ranking", `生成${fact.groupName}最终排名`, "正赛第二阶段已经全部结束，可以生成本站1—64名最终排名。", rankingHref(fact.eventId, fact.groupId), 76);
    return { ...base, competition: { phase: "ranking", step: "generate", label: "最终排名 · 待生成", completedSteps: ["competition_complete"], blocker: null }, rankingStatus, nextAction };
  }
  if (rankingStatus === "draft") {
    const nextAction = linkAction("confirm_ranking", `复核并确认${fact.groupName}最终排名`, "最终排名草稿已经生成，请复核1—64名后正式确认。", rankingHref(fact.eventId, fact.groupId), 78);
    return { ...base, competition: { phase: "ranking", step: "confirm", label: "最终排名 · 待确认", completedSteps: ["competition_complete", "ranking_generated"], blocker: null }, rankingStatus, nextAction };
  }
  if (rankingStatus === "confirmed") {
    const nextAction = linkAction("publish_ranking", `发布${fact.groupName}最终排名`, "最终排名已经确认，发布后用户端即可看到正式名次。", rankingHref(fact.eventId, fact.groupId), 66);
    return { ...base, competition: { phase: "ranking", step: "publish", label: "最终排名 · 已确认待发布", completedSteps: ["competition_complete", "ranking_confirmed"], blocker: null }, rankingStatus, nextAction };
  }
  return { ...base, competition: { phase: "complete", step: "complete", label: "本站竞赛已完成", completedSteps: ["competition_complete", "ranking_published"], blocker: null }, rankingStatus, nextAction: null };
}

function refereeAction(groups) {
  const actions = groups.map((group) => group.nextAction).filter(Boolean)
    .filter((action) => action.kind === "link" && action.href.startsWith("/admin/competition/") && !action.href.includes("final-ranking"))
    .sort((a, b) => b.priority - a.priority);
  return actions[0] || waitAction("当前暂无需要你处理的比赛", "请等待组委会完成赛事准备或新的比赛任务进入执行阶段。");
}

export function chooseEventNextAction(summary, viewerRole) {
  const { event, registration, publications, groups } = summary;
  if (viewerRole === "referee") return refereeAction(groups);
  if (event.status === "archived") return waitAction("赛事已经归档", "本站已经进入历史只读状态，没有新的赛事流程任务。");
  if (event.status === "finished") {
    if (event.isTest) return waitAction("测试赛事已结束", "永久测试赛事保留用于完整流程回归，不建议归档或删除。");
    if (event.legacyHistorical) return lifecycleAction("archive_event", "归档历史赛事", "本站属于历史只读兼容赛事，不重新生成新竞赛引擎任务；如无需继续维护，可以归档。", "archive", 58);
    const unpublished = groups.find((group) => group.rankingStatus === "confirmed" || group.rankingStatus === "draft" || group.rankingStatus === "none");
    if (unpublished) return linkAction("review_final_publication", "检查最终排名发布状态", "赛事已经结束，但仍有组别的最终排名没有完成公众发布。", rankingHref(event.id, unpublished.groupId), 64);
    return lifecycleAction("archive_event", "归档赛事", "赛事已经结束且最终排名已完成，可以将本站转入后台历史只读状态。", "archive", 58);
  }
  if (event.status === "draft") {
    if (!event.basicReady) return linkAction("complete_event_basics", "完善赛事基础资料", "开放报名之前需要先完成赛事名称、比赛日期、场馆和至少一个有效参赛组别。", `/admin/events/${encodeURIComponent(event.id)}`, 90);
    if (publications.overview !== "published") return linkAction("publish_overview", "完善并发布赛事概览", "赛事概览是开放报名的前置条件，请先完成正式发布。", `/admin/content/${encodeURIComponent(event.id)}`, 88);
    if (!registration.configReady) return linkAction("setup_registration", "设置报名信息", "请填写报名开始时间、报名截止时间和有效报名入口。", `/admin/registration-publish?event=${encodeURIComponent(event.id)}`, 86);
    return lifecycleAction("open_registration", "开放报名", "赛事基础资料、概览和报名配置已经就绪，可以正式进入报名阶段。", "open_registration", 84);
  }
  if (event.status === "registration_open") {
    if (registration.timeState === "closed") return lifecycleAction("close_registration", "报名时间已经结束，请确认结束报名", "结束报名后仍可继续完成报名审核，并开始确认正式参赛名单。", "close_registration", 100);
    if (registration.pendingCount > 0) return linkAction("review_pending_registration", `还有 ${registration.pendingCount} 名报名待审核`, "请及时完成报名审核；结束报名后，全部审核完成才能确认正式参赛名单。", `/admin/participants?event=${encodeURIComponent(event.id)}&review=pending`, 92);
    if (publications.registration !== "published") return linkAction("publish_registration", "发布报名信息到用户端", "赛事已经处于报名阶段，但报名信息尚未正式发布。", `/admin/registration-publish?event=${encodeURIComponent(event.id)}`, 82);
    return linkAction("registration_running", "报名正在进行中", `当前已有 ${registration.totalCount} 人报名，暂无待审核记录。`, `/admin/participants?event=${encodeURIComponent(event.id)}`, 45);
  }
  if (event.status === "registration_closed") {
    if (registration.pendingCount > 0) return linkAction("review_pending_registration", `还有 ${registration.pendingCount} 名报名待审核`, "全部审核完成后才能确认正式参赛名单。", `/admin/participants?event=${encodeURIComponent(event.id)}&review=pending`, 96);
    if (summary.competitionReadyToStart) return lifecycleAction("start_competition", "进入比赛中", "已有组别正式名单锁定并产生正式竞赛数据，可以将整站生命周期切换为比赛中。", "start_competition", 89);
    const task = groups.map((group) => group.nextAction).filter(Boolean).sort((a, b) => b.priority - a.priority)[0];
    return task || waitAction("等待竞赛准备", "报名已经截止，请先完成至少一个组别的正式名单与竞赛准备。");
  }
  if (event.status === "in_progress") {
    if (summary.allRankingsConfirmed) {
      return lifecycleAction("finish_event", "结束赛事", summary.allRankingsPublished ? "少年组和青年组最终排名均已确认并发布，可以正式结束本站。" : "少年组和青年组最终排名均已确认。仍有排名未发布，但这不会阻断结束赛事，请随后补齐公众发布。", "finish_event", 88);
    }
    const task = groups.map((group) => group.nextAction).filter(Boolean).sort((a, b) => b.priority - a.priority)[0];
    return task || waitAction("比赛执行中", "当前没有检测到新的待处理步骤，请检查两个组别的竞赛状态。");
  }
  return waitAction("等待下一步", "当前赛事没有需要立即处理的流程动作。");
}

export function workflowUrgencyScore(summary) {
  if (!summary || summary.event.status === "archived") return -1000;
  const action = summary.nextAction || { priority: 0 };
  const lifecycleWeight = { registration_open: 60, in_progress: 55, registration_closed: 50, draft: 35, finished: 10 }[summary.event.status] || 0;
  return lifecycleWeight + Number(action.priority || 0);
}

import fs from "node:fs";

const file = "app/snooker/snooker-data-center-v2.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`patch target not found: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`patch target is not unique: ${label}`);
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(`type SourceHealth = {
  online: boolean;
  accepted: boolean;
  fetchedAt: string;
  message: string;
};

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  databaseEvents?: SnookerEvent[];
  sourceHealth?: SourceHealth;
};`, `type SourceHealth = {
  online: boolean;
  accepted: boolean;
  fetchedAt: string;
  message: string;
  dataState?: "fresh" | "stale" | "unavailable";
  lastSuccessfulAt?: string | null;
  durationMs?: number;
  failedStage?: string;
  requestCount?: number;
};

type DashboardResponse = {
  ok?: boolean;
  snapshot?: SnookerDashboardSnapshot;
  databaseEvents?: SnookerEvent[];
  sourceHealth?: SourceHealth;
  dataState?: "fresh" | "stale" | "unavailable";
  dataVersion?: string;
  lastSuccessfulAt?: string;
  scope?: "core" | "full";
};

type EventDetailResponse = {
  ok?: boolean;
  event?: SnookerEvent;
  dataVersion?: string;
};

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
};`, "response types");

replaceOnce(`function matchSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    frames: match.frames?.map((frame) => [frame.frameNo, frame.score1, frame.score2, frame.break1, frame.break2]) ?? [],
  });
}
`, `function matchSignature(match: SnookerMatch) {
  return JSON.stringify({
    score1: match.score1,
    score2: match.score2,
    status: match.status,
    frames: match.frames?.map((frame) => [frame.frameNo, frame.score1, frame.score2, frame.break1, frame.break2]) ?? [],
  });
}

function versionTime(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function enrichCoreEvent(core: SnookerEvent, rich?: SnookerEvent) {
  if (!rich || core.slug !== rich.slug) return core;
  const richRounds = new Map(rich.rounds.map((round) => [round.key, round]));
  const rounds = core.rounds.map((round) => {
    const richRound = richRounds.get(round.key);
    if (!richRound) return round;
    const richMatches = new Map(richRound.matches.map((match) => [match.id, match]));
    return {
      ...richRound,
      ...round,
      matches: round.matches.map((match) => {
        const richMatch = richMatches.get(match.id);
        if (!richMatch) return match;
        return {
          ...richMatch,
          ...match,
          ...(richMatch.frames?.length ? { frames: richMatch.frames } : {}),
          ...(richMatch.statistics?.length ? { statistics: richMatch.statistics } : {}),
          ...(richMatch.headToHead ? { headToHead: richMatch.headToHead } : {}),
        };
      }),
    };
  });
  return {
    ...rich,
    ...core,
    ...(core.prizes?.length ? { prizes: core.prizes } : rich.prizes?.length ? { prizes: rich.prizes } : {}),
    rounds,
  };
}

function mergeCoreEvents(current: SnookerEvent[], incoming: SnookerEvent[]) {
  const currentBySlug = new Map(current.map((event) => [event.slug, event]));
  return incoming.map((event) => enrichCoreEvent(event, currentBySlug.get(event.slug)));
}

function shouldConserveBackgroundData() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as NavigatorWithConnection).connection;
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}
`, "merge helpers");

replaceOnce(`  const [matchUpdatedAt, setMatchUpdatedAt] = useState<Record<string, string>>({});
  const [selectedRankingKey, setSelectedRankingKey] = useState<SnookerCurrentRankingKey>(initialKey);
  const [rankingSection, setRankingSection] = useState<SnookerRankingSection>(initialRankingSection);
  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)])));
  const playerDirectoryScrollY = useRef(0);`, `  const [matchUpdatedAt, setMatchUpdatedAt] = useState<Record<string, string>>({});
  const [eventLoading, setEventLoading] = useState<Record<string, boolean>>({});
  const [selectedRankingKey, setSelectedRankingKey] = useState<SnookerCurrentRankingKey>(initialKey);
  const [rankingSection, setRankingSection] = useState<SnookerRankingSection>(initialRankingSection);
  const signatures = useRef(new Map(initialDatabaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)])));
  const dataVersion = useRef(initialSourceHealth?.fetchedAt ?? initialSnapshot.builtAt);
  const eventDetailInflight = useRef(new Map<string, Promise<void>>());
  const playerDirectoryScrollY = useRef(0);`, "client state");

replaceOnce(`  const eventBySlug = useMemo(() => new Map(databaseEvents.map((event) => [event.slug, event])), [databaseEvents]);
  const hasLiveMatch = useMemo(() => databaseEvents.some((event) => allMatches(event).some((match) => match.status === "live" || match.status === "session-break")), [databaseEvents]);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(\`/api/snooker/v1/dashboard?ts=\${Date.now()}\`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
      const data = await response.json() as DashboardResponse;
      if (response.ok && data.ok && data.snapshot) {
        setSnapshot(data.snapshot);
        if (data.databaseEvents) {
          const changedAt = data.sourceHealth?.fetchedAt ?? new Date().toISOString();
          const next = new Map(data.databaseEvents.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)]));
          const changed: string[] = [];
          for (const [id, signature] of next) if (signatures.current.get(id) !== signature) changed.push(id);
          signatures.current = next;
          if (changed.length) setMatchUpdatedAt((current) => ({ ...current, ...Object.fromEntries(changed.map((id) => [id, changedAt])) }));
          setDatabaseEvents(data.databaseEvents);
        }
      }
      if (data.sourceHealth) setSourceHealth(data.sourceHealth);
    } catch {
      setSourceHealth(null);
    } finally {
      setRefreshing(false);
    }
  }, []);`, `  const eventBySlug = useMemo(() => new Map(databaseEvents.map((event) => [event.slug, event])), [databaseEvents]);
  const hasLiveMatch = useMemo(() => databaseEvents.some((event) => allMatches(event).some((match) => match.status === "live" || match.status === "session-break")), [databaseEvents]);

  const loadEventDetail = useCallback((slug: string, force = false) => {
    const existing = eventDetailInflight.current.get(slug);
    if (existing && !force) return existing;

    setEventLoading((current) => ({ ...current, [slug]: true }));
    const promise = (async () => {
      try {
        const response = await fetch(\`/api/snooker/v1/event-detail?slug=\${encodeURIComponent(slug)}\${force ? \`&ts=\${Date.now()}\` : ""}\`, {
          cache: force ? "no-store" : "force-cache",
          headers: force ? { "cache-control": "no-cache" } : undefined,
        });
        if (!response.ok) return;
        const data = await response.json() as EventDetailResponse;
        if (!data.ok || !data.event) return;
        const rich = data.event;
        setDatabaseEvents((current) => current.map((event) => event.slug === slug ? enrichCoreEvent(event, rich) : event));
        setSnapshot((current) => current.event.slug === slug ? { ...current, event: enrichCoreEvent(current.event, rich) } : current);
      } catch {
        // Event detail is optional enrichment. Keep the core/LKG data on failure.
      } finally {
        setEventLoading((current) => ({ ...current, [slug]: false }));
        if (eventDetailInflight.current.get(slug) === promise) eventDetailInflight.current.delete(slug);
      }
    })();
    eventDetailInflight.current.set(slug, promise);
    return promise;
  }, []);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    setRefreshing(true);
    try {
      const response = await fetch(\`/api/snooker/v1/dashboard?scope=core&ts=\${Date.now()}\`, { cache: "no-store", headers: { "cache-control": "no-cache" } });
      const data = await response.json() as DashboardResponse;
      if (!response.ok || !data.ok || !data.snapshot) {
        if (data.sourceHealth) setSourceHealth(data.sourceHealth);
        return;
      }

      const incomingVersion = data.dataVersion ?? data.sourceHealth?.fetchedAt ?? data.snapshot.builtAt;
      if (versionTime(incomingVersion) < versionTime(dataVersion.current)) {
        if (data.sourceHealth) setSourceHealth(data.sourceHealth);
        return;
      }
      dataVersion.current = incomingVersion;

      setSnapshot((current) => ({
        ...data.snapshot!,
        event: data.snapshot!.event.slug === current.event.slug
          ? enrichCoreEvent(data.snapshot!.event, current.event)
          : data.snapshot!.event,
      }));
      if (data.databaseEvents) {
        const changedAt = data.sourceHealth?.fetchedAt ?? incomingVersion;
        setDatabaseEvents((current) => {
          const merged = mergeCoreEvents(current, data.databaseEvents!);
          const next = new Map(merged.flatMap((event) => allMatches(event)).map((match) => [match.id, matchSignature(match)]));
          const changed: string[] = [];
          for (const [id, signature] of next) if (signatures.current.get(id) !== signature) changed.push(id);
          signatures.current = next;
          if (changed.length) setMatchUpdatedAt((value) => ({ ...value, ...Object.fromEntries(changed.map((id) => [id, changedAt])) }));
          return merged;
        });
      }
      if (data.sourceHealth) setSourceHealth(data.sourceHealth);
    } catch {
      setSourceHealth((current) => current ? {
        ...current,
        online: false,
        accepted: false,
        dataState: "stale",
        message: "数据刷新暂时延迟，继续显示上一版成功数据。",
      } : current);
    } finally {
      setRefreshing(false);
    }
  }, []);`, "resilient refresh");

replaceOnce(`  const recentEvents = seasonCalendar
    .filter((item) => item.endDate < today || isActiveOn(item, today) || item.id === firstUpcomingAny?.id || item.id === featuredEventCard?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const rankingRows`, `  const recentEvents = seasonCalendar
    .filter((item) => item.endDate < today || isActiveOn(item, today) || item.id === firstUpcomingAny?.id || item.id === featuredEventCard?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const featuredEventSlug = featuredEventCard?.slug;

  useEffect(() => {
    if (!featuredEventSlug || shouldConserveBackgroundData()) return;
    const win = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (handle: number) => void };
    if (win.requestIdleCallback) {
      const handle = win.requestIdleCallback(() => void loadEventDetail(featuredEventSlug), { timeout: 6_000 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => void loadEventDetail(featuredEventSlug), 5_000);
    return () => window.clearTimeout(timer);
  }, [featuredEventSlug, loadEventDetail]);

  useEffect(() => {
    if (detail?.type !== "match") return;
    const selectedEvent = eventBySlug.get(detail.eventSlug);
    const selectedMatch = selectedEvent ? allMatches(selectedEvent).find((match) => match.id === detail.matchId) : undefined;
    if (!selectedMatch || (selectedMatch.status !== "live" && selectedMatch.status !== "session-break")) return;
    const timer = window.setInterval(() => void loadEventDetail(detail.eventSlug, true), 30_000);
    return () => window.clearInterval(timer);
  }, [detail, eventBySlug, loadEventDetail]);

  const rankingRows`, "idle event prefetch");

replaceOnce(`  const openEvent = (slug: string, tab: EventTab = "overview") => {
    setDetail({ type: "event", slug, tab });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openMatch = (matchId: string, eventSlug: string) => {
    setMatchDataTab("match");
    setDetail({ type: "match", matchId, eventSlug });
    window.scrollTo({ top: 0, behavior: "auto" });
  };`, `  const openEvent = (slug: string, tab: EventTab = "overview") => {
    void loadEventDetail(slug);
    setDetail({ type: "event", slug, tab });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openMatch = (matchId: string, eventSlug: string) => {
    void loadEventDetail(eventSlug);
    setMatchDataTab("match");
    setDetail({ type: "match", matchId, eventSlug });
    window.scrollTo({ top: 0, behavior: "auto" });
  };`, "on-demand event detail");

replaceOnce(`        {match.frames?.length ? match.frames.map((frame) => <div className={styles.frameRow} style={{ minHeight: 50 }} key={frame.frameNo}><span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span></div>) : <div className={styles.emptyFrames}>{match.status === "upcoming" ? "比赛尚未开始，逐局比分将在开赛后同步。" : "官方当前未提供该场逐局明细，已保存官方总比分。"}</div>}`, `        {match.frames?.length ? match.frames.map((frame) => <div className={styles.frameRow} style={{ minHeight: 50 }} key={frame.frameNo}><span>{frame.break1 ?? "-"}</span><strong>{frame.score1}</strong><b>{frame.frameNo}</b><strong>{frame.score2}</strong><span>{frame.break2 ?? "-"}</span></div>) : <div className={styles.emptyFrames}>{eventLoading[detail.eventSlug] ? "正在加载逐局比分与对阵数据…" : match.status === "upcoming" ? "比赛尚未开始，逐局比分将在开赛后同步。" : "官方当前未提供该场逐局明细，已保存官方总比分。"}</div>}`, "frame loading state");

fs.writeFileSync(file, source);
console.log(`patched ${file}`);

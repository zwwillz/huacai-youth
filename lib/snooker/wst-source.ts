export const WST_CHINA_OPEN_2026_ID = "5b3b0c5c-991c-444b-845d-70a1edbbdf39";

const WST_TOURNAMENTS_API = "https://tournaments.snooker.web.gc.wstservices.co.uk/v2";
const WST_MATCHES_API = "https://matches.snooker.web.gc.wstservices.co.uk/v2";
const WST_GRAPHQL_API = "https://snooker.graph.gc.wstservices.co.uk/graphql";

export type WstPlayer = {
  playerID?: string;
  firstName?: string | null;
  customFirstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  customSurname?: string | null;
  countryCode?: string | null;
};

export type WstMatchAttributes = {
  matchID?: string;
  name?: string;
  homePlayerID?: string;
  homePlayerScore?: number | null;
  awayPlayerID?: string;
  awayPlayerScore?: number | null;
  tournamentID?: string;
  startDateTime?: string | null;
  round?: string | null;
  status?: string | null;
  statusMeta?: string | null;
  numberOfFrames?: number | null;
  fixtureNumber?: number | null;
  playersAllocated?: boolean;
  homePlayer?: WstPlayer | null;
  awayPlayer?: WstPlayer | null;
};

export type WstMatchRow = {
  type?: string;
  id: string;
  attributes: WstMatchAttributes;
};

type WstRawMatchRow = WstMatchAttributes & {
  id?: string;
  type?: string;
  attributes?: WstMatchAttributes;
};

export type WstTournamentDetail = {
  id: string;
  name: string;
  matches: WstMatchRow[];
};

export type WstFrameStatus = {
  frameNumber: number;
  homePlayerPoints: number;
  awayPlayerPoints: number;
  homePlayerFiftyPlusBreaks: number;
  awayPlayerFiftyPlusBreaks: number;
};

export type WstMatchStatus = {
  homePlayerFrames: number;
  awayPlayerFrames: number;
  status: string | null;
  statusMeta: string | null;
  currentBreak: number | null;
  matchHistory?: {
    frames?: WstFrameStatus[];
  } | null;
};

function abortableFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; WorldSnookerDataCenter/0.5)",
      accept: "application/json,text/plain,*/*",
      "cache-control": "no-cache, no-store, max-age=0",
      pragma: "no-cache",
      ...(init.headers ?? {}),
    },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await abortableFetch(url, init);
  if (!response.ok) throw new Error(`WST_HTTP_${response.status}`);
  return response.json() as Promise<T>;
}

function normalizeMatchRow(raw: WstRawMatchRow): WstMatchRow | null {
  const attributes = raw.attributes ?? raw;
  const id = raw.id ?? attributes.matchID;
  if (!id) return null;
  return {
    id,
    type: raw.type ?? "match",
    attributes,
  };
}

export function wstPlayerName(player?: WstPlayer | null) {
  if (!player) return "";
  const first = player.customFirstName || player.firstName || "";
  const surname = player.customSurname || player.surname || "";
  return `${first} ${surname}`.replace(/\s+/g, " ").trim();
}

export async function fetchWstTournament(tournamentId = WST_CHINA_OPEN_2026_ID): Promise<WstTournamentDetail> {
  const payload = await fetchJson<{
    data?: { id?: string; attributes?: { name?: string; matches?: WstRawMatchRow[] } };
  }>(`${WST_TOURNAMENTS_API}/${encodeURIComponent(tournamentId)}`);
  const data = payload.data;
  const rawMatches = Array.isArray(data?.attributes?.matches) ? data.attributes.matches : [];
  const matches = rawMatches.map(normalizeMatchRow).filter((row): row is WstMatchRow => Boolean(row));
  if (!data || !matches.length) throw new Error("WST_TOURNAMENT_EMPTY");
  return {
    id: data.id ?? tournamentId,
    name: data.attributes?.name ?? "",
    matches,
  };
}

export async function fetchWstMatch(matchId: string): Promise<WstMatchRow> {
  const payload = await fetchJson<{ data?: WstRawMatchRow }>(`${WST_MATCHES_API}/${encodeURIComponent(matchId)}`);
  if (!payload.data) throw new Error("WST_MATCH_EMPTY");
  const normalized = normalizeMatchRow(payload.data);
  if (!normalized) throw new Error("WST_MATCH_INVALID");
  return normalized;
}

const MATCH_STATUS_QUERY = `query ($matchId: ID!) {
  matchStatus(matchId: $matchId) {
    homePlayerFrames
    awayPlayerFrames
    status
    statusMeta
    currentBreak
    matchHistory {
      frames {
        frameNumber
        homePlayerPoints
        awayPlayerPoints
        homePlayerFiftyPlusBreaks
        awayPlayerFiftyPlusBreaks
      }
    }
  }
}`;

export async function fetchWstMatchStatus(matchId: string): Promise<WstMatchStatus> {
  const payload = await fetchJson<{
    data?: { matchStatus?: WstMatchStatus | null };
    errors?: Array<{ message?: string }>;
  }>(WST_GRAPHQL_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-apollo-operation-name": "WorldSnookerDataCenterMatchStatus",
    },
    body: JSON.stringify({
      query: MATCH_STATUS_QUERY,
      variables: { matchId },
    }),
  });
  if (payload.errors?.length) throw new Error(`WST_GRAPHQL_${payload.errors[0]?.message ?? "ERROR"}`);
  if (!payload.data?.matchStatus) throw new Error("WST_MATCH_STATUS_EMPTY");
  return payload.data.matchStatus;
}

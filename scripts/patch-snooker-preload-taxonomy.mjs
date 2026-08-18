import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transform) {
  const source = await readFile(path, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`No changes produced for ${path}`);
  await writeFile(path, next);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Patch target not unique: ${label}`);
  return source.slice(0, index) + to + source.slice(index + from.length);
}

function replaceAllExact(source, from, to, expected, label) {
  const count = source.split(from).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} matches for ${label}, found ${count}`);
  return source.split(from).join(to);
}

await patch("lib/snooker/player-data.ts", (input) => {
  let s = input;
  s = `import type { SnookerPlayerStatus } from "./domain";\nimport { normalizePlayerStatus } from "./taxonomy";\nexport type { SnookerPlayerStatus } from "./domain";\n\n${s}`;
  s = replaceOnce(s,
    "  tourStatus: string;\n};",
    "  tourStatus: string;\n  playerStatus: SnookerPlayerStatus;\n};",
    "player list status field",
  );
  s = replaceOnce(s,
    "  tour_status: string;\n};",
    "  tour_status: string;\n  player_status: string;\n};",
    "player row status field",
  );
  s = replaceOnce(s,
    "    tourStatus: row.tour_status,\n  };",
    "    tourStatus: row.tour_status,\n    playerStatus: normalizePlayerStatus(row.player_status, row.is_current_tour, row.turned_pro),\n  };",
    "map player status",
  );
  s = replaceOnce(s,
    "  \"tour_status\",\n].join(\",\");",
    "  \"tour_status\",\n  \"player_status\",\n].join(\",\");",
    "player select status",
  );
  return s;
});

await patch("lib/snooker/player-detail-fast.ts", (input) => {
  let s = input;
  s = replaceOnce(s,
    "import type { SnookerPlayerDetail } from \"./player-data\";",
    "import type { SnookerPlayerDetail, SnookerPlayerStatus } from \"./player-data\";",
    "fast status import",
  );
  s = replaceOnce(s,
    "  tour_status: string;\n};",
    "  tour_status: string;\n  player_status: SnookerPlayerStatus;\n};",
    "fast rpc status field",
  );
  s = replaceOnce(s,
    "    tourStatus: p.tour_status,\n    nicknameEn:",
    "    tourStatus: p.tour_status,\n    playerStatus: p.player_status,\n    nicknameEn:",
    "fast mapped status",
  );
  return s;
});

await patch("lib/snooker/database-public.ts", (input) => {
  let s = input;
  s = replaceOnce(s,
    "import { dashboardSnapshot } from \"./foundation\";",
    "import { dashboardSnapshot } from \"./foundation\";\nimport { compactEventTypeLabel, normalizeEventTaxonomy, normalizePlayerStatus } from \"./taxonomy\";",
    "taxonomy import",
  );
  s = replaceOnce(s,
    "  type_zh: string | null;\n  status: string;",
    "  type_zh: string | null;\n  event_type: string | null;\n  event_stage: string | null;\n  ranking_status: string | null;\n  status: string;",
    "db event taxonomy fields",
  );
  s = replaceOnce(s,
    "  profile_source: string | null;\n};",
    "  profile_source: string | null;\n  is_current_tour: boolean;\n  tour_status: string;\n  player_status: string;\n};",
    "db player status fields",
  );
  s = replaceOnce(s,
    "function typeZh(value: string | null): SnookerCalendarEvent[\"typeZh\"] {\n  if (value === \"非排名赛\" || value === \"资格赛\") return value;\n  return \"排名赛\";\n}\n\n",
    "",
    "remove legacy type helper",
  );
  s = replaceOnce(s,
    "      profileSource: row.profile_source === \"WST\" || row.profile_source === \"snooker.org\" ? row.profile_source : \"curated\",\n    };",
    "      profileSource: row.profile_source === \"WST\" || row.profile_source === \"snooker.org\" ? row.profile_source : \"curated\",\n      isCurrentTour: row.is_current_tour,\n      tourStatus: row.tour_status,\n      playerStatus: normalizePlayerStatus(row.player_status, row.is_current_tour, row.turned_pro),\n    };",
    "snapshot player taxonomy",
  );
  s = replaceOnce(s,
    "\n    return {\n      id: `db-event-${eventRow.id}`",
    "\n    const taxonomy = normalizeEventTaxonomy(eventRow.event_type, eventRow.event_stage, eventRow.ranking_status, eventRow.type_zh);\n\n    return {\n      id: `db-event-${eventRow.id}`",
    "event detail taxonomy const",
  );
  s = replaceOnce(s,
    "      typeZh: typeZh(eventRow.type_zh),\n      status,",
    "      typeZh: compactEventTypeLabel(taxonomy),\n      eventType: taxonomy.eventType,\n      eventStage: taxonomy.eventStage,\n      rankingStatus: taxonomy.rankingStatus,\n      status,",
    "event detail taxonomy mapping",
  );
  s = replaceOnce(s,
    "      rest<DbEvent[]>(\"snooker_events?select=id,slug,season,name_en,name_zh,sponsor_name,type_zh,status,start_date,end_date,country_zh,city_zh,venue_zh,venue_en,winner_prize,runner_up_prize,currency,source_name,source_event_id,source_url,source_updated_at,referee_zh,data_ready&season=eq.2026%2F27&order=start_date.asc\"),",
    "      rest<DbEvent[]>(\"snooker_events?select=id,slug,season,name_en,name_zh,sponsor_name,type_zh,event_type,event_stage,ranking_status,status,start_date,end_date,country_zh,city_zh,venue_zh,venue_en,winner_prize,runner_up_prize,currency,source_name,source_event_id,source_url,source_updated_at,referee_zh,data_ready&season=eq.2026%2F27&order=start_date.asc\"),",
    "event rest taxonomy select",
  );
  s = replaceOnce(s,
    "      rest<DbPlayer[]>(\"snooker_players?select=id,slug,name_en,name_zh,short_name_en,short_name_zh,nationality_zh,country_code,date_of_birth,turned_pro,current_rank,ranking_points,avatar_url,profile_source&order=current_rank.asc.nullslast,name_en.asc\"),",
    "      rest<DbPlayer[]>(\"snooker_players?select=id,slug,name_en,name_zh,short_name_en,short_name_zh,nationality_zh,country_code,date_of_birth,turned_pro,current_rank,ranking_points,avatar_url,profile_source,is_current_tour,tour_status,player_status&order=current_rank.asc.nullslast,name_en.asc\"),",
    "player rest status select",
  );
  s = replaceOnce(s,
    "      const detail = detailsBySlug.get(row.slug);\n      return {",
    "      const detail = detailsBySlug.get(row.slug);\n      const taxonomy = normalizeEventTaxonomy(row.event_type, row.event_stage, row.ranking_status, row.type_zh);\n      return {",
    "calendar taxonomy const",
  );
  s = replaceOnce(s,
    "        typeZh: typeZh(row.type_zh),\n        status,",
    "        typeZh: compactEventTypeLabel(taxonomy),\n        eventType: taxonomy.eventType,\n        eventStage: taxonomy.eventStage,\n        rankingStatus: taxonomy.rankingStatus,\n        status,",
    "calendar taxonomy mapping",
  );
  return s;
});

await patch("app/snooker/snooker-data-center-v2.tsx", (input) => {
  let s = input;
  s = replaceOnce(s,
    "import { prefetchPlayerDetail } from \"./players/player-detail-client\";",
    "import { prefetchPlayerDetail, prefetchPlayerExperience } from \"./players/player-detail-client\";\nimport { eventDetailTypeLabel } from \"@/lib/snooker/taxonomy\";",
    "v2 prefetch and taxonomy import",
  );
  s = replaceOnce(s,
    "      isCurrentTour: player.currentRank !== null,\n      tourStatus: player.currentRank !== null ? \"current\" : \"unknown\",",
    "      isCurrentTour: player.isCurrentTour ?? player.currentRank !== null,\n      tourStatus: player.tourStatus ?? (player.currentRank !== null ? \"professional\" : \"unknown\"),\n      playerStatus: player.playerStatus ?? (player.currentRank !== null ? \"tour\" : player.turnedPro ? \"former_pro\" : \"amateur\"),",
    "v2 directory player status",
  );
  s = replaceOnce(s,
    "  const mainSeasonEvents = useMemo(() => seasonCalendar.filter((item) => item.typeZh !== \"资格赛\"), [seasonCalendar]);",
    "  const mainSeasonEvents = useMemo(() => seasonCalendar.filter((item) => item.eventStage !== \"qualifier\" && item.eventType !== \"pro_qualifier\" && item.typeZh !== \"资格赛\"), [seasonCalendar]);",
    "v2 main event filter",
  );
  s = replaceOnce(s,
    "    prefetchPlayerDetail(target.slug);",
    "    prefetchPlayerExperience(target.slug, target.avatarUrl || target.avatar?.url || null, \"high\");",
    "v2 click prefetch",
  );
  s = replaceAllExact(s,
    "{calendarEvent.typeZh}",
    "{eventDetailTypeLabel(calendarEvent)}",
    2,
    "event detail taxonomy labels",
  );
  return s;
});

await patch("tests/snooker-player-avatar-resolution.test.mjs", (input) => {
  let s = input;
  s = replaceOnce(s,
    "  assert.match(clientSource, /normalizePlayerDetail\\(payload\\.player\\)/);\n  assert.match(clientSource, /avatarUrl: detailAvatarUrl\\(player\\.avatarUrl\\)/);\n  assert.match(inlineSource, /avatarUrl: detailAvatarUrl\\(player\\.avatarUrl \\|\\| player\\.avatar\\?\\.url \\|\\| null\\)/);",
    "  assert.match(clientSource, /normalizePlayerDetail\\(payload\\.player\\)/);\n  assert.match(clientSource, /preloadPlayerDetailAvatar/);\n  assert.match(clientSource, /fetchPriority/);\n  assert.match(inlineSource, /displayAvatarUrl/);\n  assert.match(inlineSource, /preloadPlayerDetailAvatar\\(candidate, \\\"high\\\"\\)/);\n  assert.match(inlineSource, /avatarUrl: player\\.avatarUrl \\|\\| player\\.avatar\\?\\.url \\|\\| null/);",
    "progressive avatar regression",
  );
  return s;
});

console.log("snooker preload/taxonomy patch complete");

export const REGULATION_SNAPSHOT_VERSION = 1;

function parseJsonValue(value) {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

function asRows(value) {
  const normalized = parseJsonValue(value);
  if (!Array.isArray(normalized)) return [];
  return normalized.filter(Array.isArray).map((row) => row.map((item) => String(item ?? "")));
}

function asStrings(value) {
  const normalized = parseJsonValue(value);
  return Array.isArray(normalized) ? normalized.map((item) => String(item ?? "")).filter(Boolean) : [];
}

function asPrizeMap(value) {
  const normalized = parseJsonValue(value);
  const result = { 少年组: [], 青年组: [] };
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return result;
  result.少年组 = asRows(normalized.少年组);
  result.青年组 = asRows(normalized.青年组);
  return result;
}

export function createRegulationSnapshot(details = {}) {
  return {
    version: REGULATION_SNAPSHOT_VERSION,
    ruleStandard: String(details.ruleStandard ?? details.rule_standard ?? "").trim(),
    competitionFormat: asRows(details.competitionFormat ?? details.competition_format),
    drawRules: asStrings(details.drawRules ?? details.draw_rules),
    prizeNote: String(details.prizeNote ?? details.prize_note ?? "").trim(),
    prizes: asPrizeMap(details.prizes),
  };
}

export function parseRegulationSnapshot(value, published = true) {
  if (!published || value == null || value === "") return null;
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (Number(parsed.version) !== REGULATION_SNAPSHOT_VERSION) return null;
  return createRegulationSnapshot(parsed);
}

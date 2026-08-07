export const COMPETITION_PHASE_LABELS: Record<string, string> = {
  "qualifier-one": "资格赛第一场",
  "qualifier-two": "资格赛第二场",
  "main-one": "正赛第一阶段",
  "main-two": "正赛第二阶段",
};

export function competitionPhaseLabel(code: string, fallback?: string | null) {
  return COMPETITION_PHASE_LABELS[code] || (fallback && fallback !== code ? fallback : "竞赛阶段");
}

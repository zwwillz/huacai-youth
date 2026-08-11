export function parseRegistrationTime(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return Number.NaN;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return Date.parse(`${trimmed}${trimmed.length === 16 ? ":00" : ""}+08:00`);
  return Date.parse(trimmed);
}

export function registrationTimeState(startAt, endAt, currentTime = Date.now()) {
  if (!startAt || !endAt) return "not_set";
  const start = parseRegistrationTime(startAt);
  const end = parseRegistrationTime(endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return "not_set";
  if (currentTime < start) return "not_started";
  if (currentTime >= end) return "closed";
  return "open";
}

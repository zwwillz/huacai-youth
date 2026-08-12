export type VisitorGeoPayload = {
  clientIp?: string;
  countryName?: string;
  countryCode?: string;
  regionName?: string;
  regionCode?: string;
  cityName?: string;
};

function clean(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uniqueParts(values: string[]) {
  return values.filter((value, index) => value && value !== "-" && values.indexOf(value) === index);
}

const COUNTRY_NAMES: Record<string, string> = {
  CN: "中国",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  SG: "新加坡",
  US: "美国",
  JP: "日本",
  KR: "韩国",
};

export function describeDevice(userAgent: string) {
  const ua = clean(userAgent, 500);
  if (!ua) return "未知";
  if (/bot|spider|crawler|slurp/i.test(ua)) return "爬虫 / 机器人";

  const device = /iPhone|iPod/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Macintosh|Mac OS X/i.test(ua)
            ? "Mac"
            : /Linux/i.test(ua)
              ? "Linux"
              : "其他设备";

  const browser = /MicroMessenger/i.test(ua)
    ? "微信"
    : /Edg\//i.test(ua)
      ? "Edge"
      : /CriOS|Chrome\//i.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "浏览器";

  return `${device} / ${browser}`;
}

export function formatVisitorRegion(geo: VisitorGeoPayload | null | undefined) {
  if (!geo) return "";
  const code = clean(geo.countryCode, 8).toUpperCase();
  const country = clean(geo.countryName, 80) || COUNTRY_NAMES[code] || code;
  const region = clean(geo.regionName, 80);
  const city = clean(geo.cityName, 80);
  return uniqueParts([country, region, city]).join(" · ");
}

export function extractRequestIp(headers: Headers) {
  const candidates = [
    headers.get("x-forwarded-for")?.split(",")[0],
    headers.get("x-real-ip"),
    headers.get("true-client-ip"),
    headers.get("cf-connecting-ip"),
    headers.get("eo-client-ip"),
  ];
  for (const value of candidates) {
    const normalized = clean(value, 80).replace(/^::ffff:/, "");
    if (normalized) return normalized;
  }
  return "";
}

export function extractRequestRegion(headers: Headers) {
  const city = clean(headers.get("x-vercel-ip-city") || headers.get("x-client-city"), 80);
  const region = clean(headers.get("x-vercel-ip-country-region") || headers.get("x-client-region"), 80);
  const countryCode = clean(
    headers.get("eo-client-ipcountry") || headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry"),
    8,
  ).toUpperCase();
  return formatVisitorRegion({ countryCode, regionName: region, cityName: city });
}

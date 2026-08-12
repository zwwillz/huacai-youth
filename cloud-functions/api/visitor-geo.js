export function onRequestGet(context) {
  const geo = context.geo || {};
  const payload = {
    clientIp: context.clientIp || "",
    countryName: geo.countryName || "",
    countryCode: geo.countryCodeAlpha2 || "",
    regionName: geo.regionName || "",
    regionCode: geo.regionCode || "",
    cityName: geo.cityName || "",
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

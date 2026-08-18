import fs from "node:fs";

const path = "lib/snooker/player-data.ts";
let source = fs.readFileSync(path, "utf8");

const helperMarker = `function htmlToText(html: string | null) {\n`;
if (!source.includes("function detailAvatarUrl(value: string | null)")) {
  const helper = `function detailAvatarUrl(value: string | null) {\n  if (!value) return null;\n  return value.includes("/wst/256/") ? value.replace("/wst/256/", "/wst/512/") : value;\n}\n\n`;
  if (!source.includes(helperMarker)) throw new Error("htmlToText marker missing");
  source = source.replace(helperMarker, helper + helperMarker);
}

const returnMarker = `  return {\n    ...basePlayer,\n    nicknameEn:`;
if (!source.includes("avatarUrl: detailAvatarUrl(basePlayer.avatarUrl)")) {
  if (!source.includes(returnMarker)) throw new Error("detail return marker missing");
  source = source.replace(returnMarker, `  return {\n    ...basePlayer,\n    avatarUrl: detailAvatarUrl(basePlayer.avatarUrl),\n    nicknameEn:`);
}

fs.writeFileSync(path, source);

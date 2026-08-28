import fs from "node:fs";
const file = "app/snooker/snooker-data-center-v2.tsx";
let source = fs.readFileSync(file, "utf8");
const before = `    const promise = (async () => {`;
const after = `    let promise!: Promise<void>;\n    promise = (async () => {`;
if (!source.includes(before)) throw new Error("promise patch target missing");
source = source.replace(before, after);
fs.writeFileSync(file, source);

import fs from "node:fs";

const file = "app/snooker/snooker-data-center-v2.tsx";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`patch target not found: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`patch target is not unique: ${label}`);
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceOnce(
  `  const eventDetailInflight = useRef(new Map<string, Promise<void>>());\n  const playerDirectoryScrollY = useRef(0);`,
  `  const eventDetailInflight = useRef(new Map<string, Promise<void>>());\n  const eventDetailRequestIds = useRef(new Map<string, symbol>());\n  const playerDirectoryScrollY = useRef(0);`,
  "request-id ref",
);

replaceOnce(
  `    setEventLoading((current) => ({ ...current, [slug]: true }));\n    let promise!: Promise<void>;\n    promise = (async () => {`,
  `    setEventLoading((current) => ({ ...current, [slug]: true }));\n    const requestId = Symbol(slug);\n    eventDetailRequestIds.current.set(slug, requestId);\n    const promise = (async () => {`,
  "const promise",
);

replaceOnce(
  `      } finally {\n        setEventLoading((current) => ({ ...current, [slug]: false }));\n        if (eventDetailInflight.current.get(slug) === promise) eventDetailInflight.current.delete(slug);\n      }`,
  `      } finally {\n        if (eventDetailRequestIds.current.get(slug) === requestId) {\n          eventDetailRequestIds.current.delete(slug);\n          eventDetailInflight.current.delete(slug);\n          setEventLoading((current) => ({ ...current, [slug]: false }));\n        }\n      }`,
  "request cleanup",
);

fs.writeFileSync(file, source);
console.log(`patched ${file}`);

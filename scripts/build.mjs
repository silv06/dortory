import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8", ".png": "image/png",
  ".webp": "image/webp", ".woff": "font/woff", ".ttf": "font/ttf", ".pdf": "application/pdf",
};
const assets = {};
async function collect(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else {
      const type = mime[extname(entry.name)] ?? "text/plain; charset=utf-8";
      const key = "/" + relative("site", path).replaceAll("\\", "/");
      assets[key] = [type, (await readFile(path)).toString("base64")];
    }
  }
}

await collect("site");
const variables = [
  `const SITE_FILES = ${JSON.stringify(assets)};`,
  `const KNOWLEDGE = ${JSON.stringify(JSON.parse(await readFile("worker/knowledge.json", "utf8")))};`,
  `const APARTMENTS = ${JSON.stringify(JSON.parse(await readFile("worker/apartments.json", "utf8")))};`,
  `const GREEN_SNAPSHOT = ${JSON.stringify(JSON.parse(await readFile("worker/green.json", "utf8")))};`,
];
const script = [variables.join("\n"), await readFile("site/data.js", "utf8"),
  await readFile("worker/audit.js", "utf8"), await readFile("worker/gmail.js", "utf8"),
  await readFile("worker/receipts.js", "utf8"), await readFile("worker/case-workflow.js", "utf8"),
  await readFile("worker/operations.js", "utf8"),
  await readFile("worker/vercel-bridge.js", "utf8"), await readFile("worker/index.js", "utf8")].join("\n");
const compressedSize = gzipSync(script).length;
if (compressedSize > 3 * 1024 * 1024) throw new Error(`Worker uses ${compressedSize} bytes compressed.`);
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await writeFile("dist/server/index.js", script, "utf8");
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
console.log(`Worker ready · ${Object.keys(assets).length} assets · ${compressedSize} compressed bytes`);

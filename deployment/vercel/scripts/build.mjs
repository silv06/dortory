import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

await mkdir("public", { recursive: true });
await cp("site", "public", { recursive: true });
const index = await readFile("public/index.html", "utf8");
const origin = process.env.DORTORY_PUBLIC_ORIGIN;
if (origin && !/^https:\/\/[a-z\d-]+\.vercel\.app$/.test(origin)) throw new Error("Invalid public origin");
await writeFile("public/index.html", index.replace(
  '<meta name="description"',
  '<meta name="application-name" content="dortory">\n    <meta name="description"',
).replace('    <script src="./data.js"', `    <script>window.dortoryVercel = true;${origin ? `if(location.protocol==='https:'&&location.origin!==${JSON.stringify(origin)})location.replace(${JSON.stringify(origin)}+location.pathname+location.search+location.hash);` : ""}</script>\n    <script src="./data.js"`));
console.log("dortory · Vercel assets prepared");

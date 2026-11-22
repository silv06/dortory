import { createHmac } from "node:crypto";
import { googleRoute, verifyGoogleIdentity } from "../lib/google.mjs";

const SOURCE = "https://finder-seocheon-housing.boldchord514.chatgpt.site";
const API_PATHS = new Set(["/api/admin/session", "/api/admin/logs", "/api/admin/mail", "/api/workspace", "/api/user/cases", "/api/rag/status", "/api/rag/query"]);
const USER_COOKIE = "__Host-dortory_portal";
const ADMIN_COOKIE = "__Host-dortory_admin";

function cookieValue(header, name) {
  const match = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return match?.slice(name.length + 1) ?? "";
}

function cookie(name, value, seconds, sameSite = "Lax") {
  return `${name}=${value}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=${sameSite}`;
}

function reply(status, body, cookies = []) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const line of cookies) headers.append("Set-Cookie", line);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" });
  for (const line of cookies) headers.append("Set-Cookie", line);
  return new Response(null, { status: 303, headers });
}

function sign(secret, content) {
  return createHmac("sha256", secret).update(content).digest("base64url");
}

function safeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.length > 1000) return "/#/dashboard";
  const parsed = new URL(value, "https://dortory.invalid");
  return parsed.origin === "https://dortory.invalid" ? parsed.pathname + parsed.search + parsed.hash : "/#/dashboard";
}

function canonicalOrigin(environment) {
  const value = environment.DORTORY_PUBLIC_ORIGIN || ("https://" + environment.VERCEL_URL);
  const url = new URL(value);
  if (url.origin !== value || url.protocol !== "https:" || !/^[a-z\d-]+\.vercel\.app$/.test(url.hostname)) throw new Error("Invalid deployed origin");
  return value;
}

async function relay(environment, origin, fields, upstream = fetch) {
  const packet = JSON.stringify({ version: 1, timestamp: Date.now(), origin, ...fields });
  const response = await upstream(SOURCE + "/api/vercel/relay", {
    method: "POST", redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "OAI-Sites-Authorization": "Bearer " + environment.DORTORY_ORIGIN_ACCESS,
      "X-Dortory-Signature": sign(environment.DORTORY_VERCEL_SECRET, packet),
    },
    body: packet, signal: AbortSignal.timeout(18000),
  });
  const type = response.headers.get("Content-Type") || "";
  if (!type.includes("application/json")) throw new Error("Unexpected origin response");
  return response;
}

export async function handlePortal(request, environment = process.env, upstream = fetch, verifyIdentity = verifyGoogleIdentity) {
  const incoming = new URL(request.url);
  const route = incoming.searchParams.get("route") || incoming.pathname;
  if (!environment.DORTORY_VERCEL_SECRET || !environment.DORTORY_ORIGIN_ACCESS) {
    return reply(503, { error: "도토리의 서버 연결 설정을 확인해 주세요." });
  }
  let origin;
  try { origin = canonicalOrigin(environment); } catch { return reply(503, { error: "도토리 배포 주소를 확인해 주세요." }); }
  const google = await googleRoute({request, env: environment, upstream, verifyIdentity, origin, route, relay, cookieValue, cookie, reply, redirect, safeNext});
  if (google) return google;
  const session = cookieValue(request.headers.get("Cookie"), USER_COOKIE);
  if (route === "/auth/logout" || route === "/signout-with-chatgpt") {
    if (request.method !== "POST" || request.headers.get("Origin") !== origin) return reply(405, { error: "지원하지 않는 요청입니다." });
    try { await relay(environment, origin, { action: "revoke", session }, upstream); }
    catch { return reply(503, { error: "로그아웃을 완료하지 못했습니다. 다시 시도해 주세요." }); }
    return redirect("/#/dashboard", [cookie(USER_COOKIE, "", 0), cookie(ADMIN_COOKIE, "", 0, "Strict")]);
  }
  if (!API_PATHS.has(route) || !["GET", "POST", "PUT", "DELETE"].includes(request.method)) {
    return reply(404, { error: "요청한 기능을 찾을 수 없습니다." });
  }
  if (!["GET", "HEAD"].includes(request.method) && (request.headers.get("Origin") !== origin
    || request.headers.get("Content-Type")?.split(";")[0] !== "application/json")) {
    return reply(403, { error: "도토리 화면에서 다시 시도해 주세요." });
  }
  let body;
  if (request.method !== "GET") {
    const text = await request.text();
    if (text.length > 1100000) return reply(413, { error: "요청 분량을 확인해 주세요." });
    try { body = JSON.parse(text); } catch { return reply(400, { error: "입력 항목을 확인해 주세요." }); }
  }
  let path = route;
  if (route === "/api/workspace" && incoming.searchParams.get("refresh") === "1") path += "?refresh=1";
  if (route === "/api/admin/logs") {
    const search = new URLSearchParams();
    for (const key of ["before", "action", "outcome"]) if (incoming.searchParams.has(key)) search.set(key, incoming.searchParams.get(key));
    if (search.size) path += "?" + search;
  }
  try {
    const response = await relay(environment, origin, {
      action: "request", path, method: request.method, body, session,
      adminSession: cookieValue(request.headers.get("Cookie"), ADMIN_COOKIE),
    }, upstream);
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
    if (route === "/api/admin/session" && response.ok) {
      if (request.method === "DELETE") headers.set("Set-Cookie", cookie(ADMIN_COOKIE, "", 0, "Strict"));
      else if (request.method === "POST") {
        const grant = response.headers.get("Set-Cookie")?.match(/(?:^|,\s*)__Host-dortory_admin=([a-f\d]{64})(?:;|,|$)/);
        if (!grant) return reply(503, { error: "관리자 세션을 연결하지 못했습니다. 다시 로그인해 주세요." });
        headers.set("Set-Cookie", cookie(ADMIN_COOKIE, grant[1], 8 * 60 * 60, "Strict"));
      }
    }
    return new Response(response.body, { status: response.status, headers });
  } catch {
    console.error(JSON.stringify({ service: "dortory", event: "origin_request", outcome: "failed", path: route }));
    return reply(503, { error: "도토리 자료 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

export default async function handler(req, res) {
  const origin = "https://" + (req.headers.host || process.env.VERCEL_URL || "invalid.vercel.app");
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) if (value != null) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  const options = { method: req.method, headers };
  if (!["GET", "HEAD"].includes(req.method)) {
    options.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  }
  const url = new URL(req.url, origin);
  if (typeof req.query?.route === "string") url.searchParams.set("route", req.query.route);
  const response = await handlePortal(new Request(url.href, options));
  res.statusCode = response.status;
  for (const [key, value] of response.headers) if (key.toLowerCase() !== "set-cookie") res.setHeader(key, value);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

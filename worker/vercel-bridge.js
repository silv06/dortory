const BRIDGE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const BRIDGE_API_PATHS = new Set(["/api/admin/session", "/api/admin/logs", "/api/admin/mail", "/api/workspace", "/api/user/cases", "/api/rag/status", "/api/rag/query"]);

function bridgeBase64(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bridgeDecode(text) {
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

async function verifyBridge(secret, content, signature) {
  if (!secret || typeof signature !== "string" || !/^[\w-]{43}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bridgeDecode(signature), new TextEncoder().encode(content));
}

function validBridgePacket(packet) {
  if (!packet || packet.version !== 1 || !Number.isSafeInteger(packet.timestamp)
    || Math.abs(Date.now() - packet.timestamp) > 120000 || typeof packet.origin !== "string") return false;
  try {
    const origin = new URL(packet.origin);
    return origin.origin === packet.origin && origin.protocol === "https:"
      && /^[a-z\d-]+\.vercel\.app$/.test(origin.hostname);
  } catch { return false; }
}

async function linkLegacyOwner(env, user) {
  if (!isDesignatedAdmin(user, env) || !env.DORTORY_LEGACY_OWNER_ID || user.id === env.DORTORY_LEGACY_OWNER_ID) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await readOperations(env.DB);
    if (!saved) return;
    const owned = saved.database.cases.filter((item) => item.accountId === env.DORTORY_LEGACY_OWNER_ID);
    if (!owned.length) return;
    for (const item of owned) item.accountId = user.id;
    const results = await env.DB.batch([
      env.DB.prepare("UPDATE dortory_workspace SET revision=revision+1, contents=?, updated_at=? WHERE user_id=? AND revision=?")
        .bind(JSON.stringify(saved.database), Date.now(), OPERATIONS_KEY, saved.revision),
      auditStatement(env.DB, user, "account.link", "", "success", String(owned.length), true),
      env.DB.prepare(`UPDATE dortory_receipts SET account_id=? WHERE account_id=? AND case_id IN
        (SELECT json_extract(value, '$.id') FROM dortory_workspace, json_each(contents, '$.cases')
        WHERE user_id=? AND json_extract(value, '$.accountId')=?)`)
        .bind(user.id, env.DORTORY_LEGACY_OWNER_ID, OPERATIONS_KEY, user.id),
    ]);
    if (results[0].meta.changes) return;
  }
  throw new Error("Owner account linking conflict");
}

async function vercelRelay(request, env) {
  if (request.method !== "POST" || !env.DB || !env.DORTORY_VERCEL_SECRET) return json({ error: "연결할 수 없습니다." }, 403);
  const raw = await request.text();
  if (raw.length > 1300000 || !await verifyBridge(env.DORTORY_VERCEL_SECRET, raw, request.headers.get("X-Dortory-Signature"))) {
    return json({ error: "허용되지 않은 연결입니다." }, 403);
  }
  let packet;
  try { packet = JSON.parse(raw); } catch { return json({ error: "요청 형식을 확인해 주세요." }, 400); }
  if (!validBridgePacket(packet)) return json({ error: "연결 요청이 만료됐습니다." }, 403);
  if (packet.action === "google-session") {
    const user = packet.user;
    if (!user || !/^google:[\w-]{1,255}$/.test(user.id ?? "") || !normalizeEmail(user.email)) return json({ error: "구글 계정을 확인해 주세요." }, 403);
    await linkLegacyOwner(env, user);
    const admin = packet.issueAdmin === true && isDesignatedAdmin(user, env)
      ? await prepareAdminSession(env, user) : null;
    const session = hex(crypto.getRandomValues(new Uint8Array(32)));
    const expires = Date.now() + BRIDGE_SESSION_MS;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM dortory_host_sessions WHERE expires_at<=?").bind(Date.now()),
      env.DB.prepare("INSERT INTO dortory_host_sessions (session_key, contents, expires_at) VALUES (?, ?, ?)")
        .bind("user:" + await tokenDigest(session), JSON.stringify({ user, origin: packet.origin }), expires),
      auditStatement(env.DB, user, "auth.google.login"),
      ...(admin?.statements ?? []),
    ]);
    return json({ session, expires, admin: admin ? { token: admin.token, expires: admin.expires } : null });
  }
  if (packet.action === "auth-failure") {
    await recordAudit(env, null, packet.purpose === "mail" ? "mail.connect" : "auth.google.login", "", "failed");
    return json({ recorded: true });
  }
  let user = null;
  let sessionKey;
  if (packet.session && /^[a-f\d]{64}$/.test(packet.session)) {
    sessionKey = "user:" + await tokenDigest(packet.session);
    const session = await env.DB.prepare("SELECT contents FROM dortory_host_sessions WHERE session_key=? AND expires_at>?")
      .bind(sessionKey, Date.now()).first();
    if (session) {
      const grant = JSON.parse(session.contents);
      if (grant.origin === packet.origin) user = grant.user;
    }
  }
  if (packet.action === "revoke") {
    if (user) await env.DB.batch([
      env.DB.prepare("DELETE FROM dortory_host_sessions WHERE session_key=?").bind(sessionKey),
      env.DB.prepare("DELETE FROM dortory_admin_sessions WHERE user_id=?").bind(user.id),
      auditStatement(env.DB, user, "auth.logout"),
    ]);
    return json({ revoked: true });
  }
  if (packet.action === "configure-mail") {
    const headers = new Headers();
    if (user) { headers.set("oai-authenticated-user-id", user.id); headers.set("oai-authenticated-user-email", user.email); }
    if (/^[a-f\d]{64}$/.test(packet.adminSession ?? "")) headers.set("Cookie", ADMIN_COOKIE + "=" + packet.adminSession);
    return configureGmail(env, new Request(packet.origin, { headers }), packet.user, packet.refreshToken, packet.mailClient);
  }
  if (packet.action !== "request" || !BRIDGE_API_PATHS.has(packet.path?.split("?")[0])
    || !["GET", "POST", "PUT", "DELETE"].includes(packet.method)) return json({ error: "지원하지 않는 요청입니다." }, 400);
  const path = new URL(packet.path, packet.origin);
  if (path.origin !== packet.origin) return json({ error: "잘못된 요청 주소입니다." }, 400);
  const headers = new Headers({ Origin: packet.origin, "Content-Type": "application/json" });
  if (user) {
    headers.set("oai-authenticated-user-id", user.id);
    headers.set("oai-authenticated-user-email", user.email);
  }
  if (/^[a-f\d]{64}$/.test(packet.adminSession ?? "")) headers.set("Cookie", ADMIN_COOKIE + "=" + packet.adminSession);
  const options = { method: packet.method, headers };
  if (!["GET", "HEAD"].includes(packet.method)) options.body = JSON.stringify(packet.body ?? {});
  return appRequest(new Request(path.href, options), { ...env, DORTORY_SITE_ORIGIN: packet.origin });
}

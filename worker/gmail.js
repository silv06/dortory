async function integrationKey(env) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("dortory:gmail:" + env.DORTORY_VERCEL_SECRET));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function readGmail(env) {
  if (!env.DB || !env.DORTORY_VERCEL_SECRET) return null;
  const row = await env.DB.prepare("SELECT contents FROM dortory_integrations WHERE id='gmail'").first();
  if (!row) return null;
  const sealed = JSON.parse(row.contents);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bridgeDecode(sealed.iv), additionalData: new TextEncoder().encode("dortory:gmail:v1") },
    await integrationKey(env), bridgeDecode(sealed.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function configureGmail(env, request, user, refreshToken, mailClient) {
  const current = identity(request);
  if (!await activeAdmin(request, env, current) || user?.id !== current?.id || user.email !== current.email
    || !mailClient?.id?.endsWith(".apps.googleusercontent.com") || typeof mailClient?.secret !== "string" || typeof refreshToken !== "string" || !refreshToken || refreshToken.length > 4000) {
    await recordAudit(env, current, "mail.connect", "", "denied");
    return json({ error: "관리자 본인의 Gmail 계정을 연결해 주세요." }, 403);
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const contents = JSON.stringify({ email: user.email, refreshToken, clientId: mailClient.id, clientSecret: mailClient.secret });
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode("dortory:gmail:v1") },
    await integrationKey(env), new TextEncoder().encode(contents));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO dortory_integrations (id, contents, updated_at) VALUES ('gmail', ?, ?) ON CONFLICT(id) DO UPDATE SET contents=excluded.contents, updated_at=excluded.updated_at")
      .bind(JSON.stringify({ iv: bridgeBase64(iv), data: bridgeBase64(new Uint8Array(sealed)) }), Date.now()),
    auditStatement(env.DB, current, "mail.connect"),
  ]);
  return json({ connected: true });
}
async function adminMail(request, env) {
  if (!await activeAdmin(request, env)) return json({ error: "관리자 로그인이 필요합니다." }, 403);
  if (request.method !== "GET") return json({ error: "지원하지 않는 요청입니다." }, 405);
  const sender = await readGmail(env);
  return json({ connected: Boolean(sender), provider: sender ? "gmail" : mailIsConfigured(env) ? "resend" : "", email: sender?.email ?? "" });
}
async function receiptRuntime(env) {
  const sender = await readGmail(env);
  return sender ? { ...env, GMAIL_SENDER: sender } : env;
}
function mailBase64(value) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}
async function sendGmailReceipt(item, env) {
  const sender = env.GMAIL_SENDER;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: sender.clientId, client_secret: sender.clientSecret,
      refresh_token: sender.refreshToken, grant_type: "refresh_token" }), signal: AbortSignal.timeout(5000),
  });
  if (!tokenResponse.ok) return { state: "failed", code: "gmail_token_" + tokenResponse.status };
  const token = await tokenResponse.json();
  if (!token.access_token) return { state: "failed", code: "gmail_token_missing" };
  const message = receiptMessage(item, sender.email, env);
  const mime = [
    `From: =?UTF-8?B?${mailBase64("도토리")}?= <${sender.email}>`,
    `To: ${normalizeEmail(item.contactEmail)}`, `Subject: =?UTF-8?B?${mailBase64(message.subject)}?=`,
    `Message-ID: <dortory-${item.id}-${item.clientRequest}@gmail.com>`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
    mailBase64(message.text).match(/.{1,76}/g).join("\r\n"),
  ].join("\r\n");
  const raw = bridgeBase64(new TextEncoder().encode(mime));
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", redirect: "manual", headers: { Authorization: "Bearer " + token.access_token, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }), signal: AbortSignal.timeout(6000),
  });
  if (response.ok) { const result = await response.json(); return result.id ? { state: "sent", providerId: result.id } : { state: "unknown", code: "gmail_no_confirmation" }; }
  return { state: response.status >= 400 && response.status < 500 ? "failed" : "unknown", code: "gmail_http_" + response.status };
}

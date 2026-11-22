import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_KEYS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const FLOW_COOKIE = "__Host-dortory_google";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const signature = (secret, value) => createHmac("sha256", secret).update(value).digest("base64url");
function equal(a, b) {
  const left = Buffer.from(a ?? ""); const right = Buffer.from(b ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function verifyGoogleIdentity(token, audience, nonce, keys = GOOGLE_KEYS) {
  const { payload } = await jwtVerify(token, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"], audience, algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "email", "email_verified", "nonce"], maxTokenAge: "10m", clockTolerance: 10,
  });
  if (!equal(payload.nonce, nonce) || payload.email_verified !== true || typeof payload.sub !== "string"
    || !/^[\w-]{1,255}$/.test(payload.sub) || typeof payload.email !== "string" || payload.email.length > 254) throw new Error("Google identity rejected");
  return { id: "google:" + payload.sub, email: payload.email.trim().toLowerCase() };
}
function readFlow(request, env, cookieValue) {
  const value = cookieValue(request.headers.get("Cookie"), FLOW_COOKIE);
  if (value.length > 3000) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !equal(sig, signature(env.DORTORY_VERCEL_SECRET, payload))) return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isSafeInteger(flow.at) && Date.now() - flow.at >= 0 && Date.now() - flow.at <= 300000 ? flow : null;
  } catch { return null; }
}
export async function googleRoute({request, env, upstream, verifyIdentity = verifyGoogleIdentity, origin, route, relay, cookieValue, cookie, reply, redirect, safeNext}) {
  const incoming = new URL(request.url);
  const session = cookieValue(request.headers.get("Cookie"), "__Host-dortory_portal");
  const adminSession = cookieValue(request.headers.get("Cookie"), "__Host-dortory_admin");
  const forward = (fields) => relay(env, origin, { session, adminSession, ...fields }, upstream);
  const clearFlow = cookie(FLOW_COOKIE, "", 0);
  const configured = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET;
  if (["/auth/google/start", "/auth/google/mail/start", "/signin-with-chatgpt", "/auth/start"].includes(route)) {
    if (request.method !== "GET") return reply(405, { error: "지원하지 않는 요청입니다." });
    if (!configured) return reply(503, { error: "구글 로그인 설정을 준비하고 있습니다." });
    if (incoming.origin !== origin) return redirect(origin + route + incoming.search);
    const mail = route === "/auth/google/mail/start";
    if (mail) {
      const response = await forward({ action: "request", path: "/api/admin/session", method: "GET" });
      if (!response.ok || !(await response.json()).active) return reply(403, { error: "관리자로 로그인한 뒤 발신 계정을 연결해 주세요." });
    }
    const flow = { at: Date.now(), state: randomBytes(32).toString("base64url"), nonce: randomBytes(32).toString("base64url"),
      verifier: randomBytes(32).toString("base64url"), purpose: mail ? "mail" : "login", binding: mail ? hash(session) : "", adminToken: mail ? adminSession : "",
      next: mail ? "/#/staff/logs" : safeNext(incoming.searchParams.get("return_to")) };
    const payload = Buffer.from(JSON.stringify(flow)).toString("base64url");
    const location = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    location.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: origin + "/auth/google/callback",
      response_type: "code", scope: "openid email profile" + (mail ? " " + GMAIL_SCOPE : ""), state: flow.state, nonce: flow.nonce,
      code_challenge: hash(flow.verifier), code_challenge_method: "S256", prompt: mail ? "consent" : "select_account",
      ...(mail ? { access_type: "offline", include_granted_scopes: "false" } : {}),
    });
    return redirect(location.href, [cookie(FLOW_COOKIE, payload + "." + signature(env.DORTORY_VERCEL_SECRET, payload), 300)]);
  }
  if (route !== "/auth/google/callback") return null;
  if (request.method !== "GET") return reply(405, { error: "지원하지 않는 요청입니다." });
  const flow = readFlow(request, env, cookieValue);
  if (!configured || incoming.origin !== origin || !flow || !equal(flow.state, incoming.searchParams.get("state"))
    || (flow.purpose === "mail" && !equal(flow.binding, hash(session)))) {
    return reply(403, { error: "로그인 확인 요청이 일치하지 않습니다. 로그인을 다시 시작해 주세요." }, [clearFlow]);
  }
  if (incoming.searchParams.has("error")) return redirect(flow.purpose === "mail" ? "/#/staff/logs?connection=cancelled" : safeNext(flow.next), [clearFlow]);
  const code = incoming.searchParams.get("code");
  if (!code || code.length > 3000) return reply(400, { error: "구글 계정 확인 코드를 받지 못했습니다." }, [clearFlow]);
  try {
    const exchange = await upstream("https://oauth2.googleapis.com/token", {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: origin + "/auth/google/callback", grant_type: "authorization_code", code_verifier: flow.verifier }),
      signal: AbortSignal.timeout(8000),
    });
    const tokens = await exchange.json();
    if (!exchange.ok || typeof tokens.id_token !== "string") throw new Error("Google token exchange failed");
    const user = await verifyIdentity(tokens.id_token, env.GOOGLE_CLIENT_ID, flow.nonce);
    if (flow.purpose === "mail") {
      if (!tokens.scope?.split(" ").includes(GMAIL_SCOPE) || !tokens.refresh_token) throw new Error("Missing sender grant");
      const result = await forward({ action: "configure-mail", adminSession: flow.adminToken, user, refreshToken: tokens.refresh_token, mailClient: { id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET } });
      if (!result.ok) throw new Error("Sender account rejected");
      return redirect("/#/staff/logs?connection=connected", [clearFlow]);
    }
    const result = await forward({ action: "google-session", user, issueAdmin: true });
    const grant = await result.json();
    if (!result.ok || !/^[a-f\d]{64}$/.test(grant.session ?? "") || !Number.isSafeInteger(grant.expires)) throw new Error("Session unavailable");
    const seconds = (expires) => Math.max(0, Math.floor((expires - Date.now()) / 1000));
    const admin = grant.admin;
    if (admin && (!/^[a-f\d]{64}$/.test(admin.token ?? "") || !Number.isSafeInteger(admin.expires))) {
      throw new Error("Administrator session unavailable");
    }
    return redirect(safeNext(flow.next), [
      clearFlow,
      cookie("__Host-dortory_portal", grant.session, seconds(grant.expires)),
      cookie("__Host-dortory_admin", admin?.token ?? "", admin ? seconds(admin.expires) : 0, "Strict"),
    ]);
  } catch {
    console.error(JSON.stringify({ service: "dortory", event: "google_callback", outcome: "failed", purpose: flow.purpose }));
    await forward({ action: "auth-failure", purpose: flow.purpose }).catch(() => {});
    return reply(503, { error: "구글 계정 연결을 완료하지 못했습니다. 도토리에서 다시 연결해 주세요." }, [clearFlow]);
  }
}

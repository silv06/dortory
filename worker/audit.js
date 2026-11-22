function auditValues(user, action, resource = "", outcome = "success", detail = "") {
  const email = user?.email ?? "";
  const label = email ? email[0] + "***@" + email.split("@")[1] : user?.id ? "이용자" : "시스템";
  return [Date.now(), user?.id ?? "", label, action, resource, outcome, detail];
}
function auditStatement(db, user, action, resource = "", outcome = "success", detail = "", conditional = false) {
  return db.prepare(`INSERT INTO dortory_audit_logs (at, actor_id, actor_label, action, resource, outcome, detail)
    SELECT ?, ?, ?, ?, ?, ?, ?${conditional ? " WHERE changes()=1" : ""}`)
    .bind(...auditValues(user, action, resource, outcome, detail));
}
async function recordAudit(env, user, action, resource = "", outcome = "success", detail = "") {
  try { if (env.DB) await auditStatement(env.DB, user, action, resource, outcome, detail).run(); }
  catch { console.error(JSON.stringify({ service: "dortory", event: "audit_write", outcome: "failed", action })); }
}
async function adminLogs(request, env) {
  if (!await activeAdmin(request, env)) return json({ error: "관리자 로그인이 필요합니다." }, 403);
  if (request.method !== "GET") return json({ error: "지원하지 않는 요청입니다." }, 405);
  const params = new URL(request.url).searchParams;
  const before = Number(params.get("before")) || Number.MAX_SAFE_INTEGER;
  const action = params.get("action")?.slice(0, 60) ?? "";
  const outcome = params.get("outcome")?.slice(0, 20) ?? "";
  const rows = (await env.DB.prepare(`SELECT id, at, actor_label, action, resource, outcome, detail FROM dortory_audit_logs
    WHERE id<? AND (?='' OR action=?) AND (?='' OR outcome=?) ORDER BY id DESC LIMIT 51`)
    .bind(before, action, action, outcome, outcome).all()).results;
  return json({ rows: rows.slice(0, 50), next: rows.length > 50 ? rows[49].id : null });
}

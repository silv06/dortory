let auditPage = { rows: [], next: null };
let senderStatus = { connected: false, email: "" };
const AUDIT_ACTIONS = {
  "auth.google.login": "구글 로그인", "auth.logout": "계정 로그아웃", "account.link": "기존 관리자 상담 연결", "admin.login": "관리자 로그인", "admin.logout": "관리자 로그아웃",
  "workspace.update": "상담·대장 저장", "case.create": "상담 신청", "case.claim": "현장 상담 연결", "case.visit": "방문 요청",
  "case.field.create": "현장 상담 등록", "case.demo.create": "매칭 시연 시작",
  "case.confirm-intake": "상담 정보 확인", "case.select-housing": "주택·통근 조합 선택",
  "case.finish-ai-review": "AI 도토리 검토 확인", "case.prepare-visit": "입주 서류 준비 확인",
  "case.schedule-visit": "현장 방문 접수", "case.confirm-contract": "방문·계약 확인",
  "case.record-submission": "제출 결과 기록", "case.confirm-move": "입주 확인",
  "case.acknowledge": "서류 안내 확인", "case.aftercare": "사후관리 요청", "mail.connect": "발신 계정 연결", "mail.send": "접수 메일 발송", "api.error": "서버 오류",
};
const AUDIT_OUTCOMES = { success: "완료", failed: "실패", denied: "접근 거부", unknown: "결과 확인 필요" };
async function loadAuditPage(params = new URLSearchParams()) {
  const query = new URLSearchParams();
  for (const key of ["before", "action", "outcome"]) if (params.has(key)) query.set(key, params.get(key));
  const [logs, mail] = await Promise.all([requestSite("/api/admin/logs?" + query), requestSite("/api/admin/mail")]);
  auditPage = logs; senderStatus = mail;
}
function auditDetail(row) {
  if (row.action === "workspace.update") {
    try { const value = JSON.parse(row.detail); return `상담 ${value.cases}건 · 주택 ${value.homes}곳 · 통근 ${value.transits}편`; } catch { return ""; }
  }
  return row.action === "mail.send" ? row.detail === "gmail" ? "Gmail" : "메일 서비스" : row.action === "api.error" ? row.detail : "";
}
function adminLogPage(params) {
  const filtered = params.get("action") || "";
  const outcome = params.get("outcome") || "";
  return `<div class="wrap page audit-page">
    ${pageHead("활동 로그", "로그인, 상담 처리, 대장 저장과 메일 발송 결과를 확인합니다.")}
    <section class="paper mail-settings" aria-labelledby="sender-title">
      <div><h2 id="sender-title">접수 메일</h2><p>${senderStatus.connected ? `발신 계정 ${escapeHtml(senderStatus.email)}` : "접수 안내를 보낼 발신 계정을 연결하세요."}</p>
      <p class="subtle">상담번호와 접수 일시, 운영일 기준 2일 이내 확인 안내를 보냅니다.</p></div>
      ${window.dortoryVercel ? `<a class="button button-soft" href="/auth/google/mail/start" target="_top">${senderStatus.connected ? "발신 계정 다시 연결" : "Gmail 발신 계정 연결"}</a>` : ""}
    </section>
    ${params.get("connection") === "connected" ? '<p class="form-success" role="status">메일 발신 계정을 연결했습니다.</p>' : params.get("connection") === "cancelled" ? '<p role="status">메일 발신 계정 연결을 취소했습니다.</p>' : ""}
    <form id="audit-filter" class="registry-filter">
      ${field("활동", "auditAction", select("auditAction", { "": "전체 활동", ...AUDIT_ACTIONS }, filtered))}
      ${field("처리 결과", "auditOutcome", select("auditOutcome", { "": "전체 결과", ...AUDIT_OUTCOMES }, outcome))}
      <button class="button button-soft" type="submit">조회</button>
    </form>
    <div class="audit-scroll"><table class="audit-table"><caption class="sr-only">관리자 활동 기록</caption>
      <thead><tr><th scope="col">일시</th><th scope="col">활동</th><th scope="col">상담번호</th><th scope="col">처리 결과</th><th scope="col">실행자</th></tr></thead>
      <tbody>${auditPage.rows.length ? auditPage.rows.map((row) => `<tr><td>${escapeHtml(displayDate(new Date(row.at).toISOString(), { year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }))}</td>
        <td>${escapeHtml(AUDIT_ACTIONS[row.action] || row.action)}${auditDetail(row) ? `<small>${escapeHtml(auditDetail(row))}</small>` : ""}</td>
        <td>${/^SC-\d+$/.test(row.resource) ? `<a class="text-link" href="#/staff/cases/${escapeHtml(row.resource)}">${escapeHtml(row.resource)}</a>` : "—"}</td>
        <td>${statusTag(AUDIT_OUTCOMES[row.outcome] || row.outcome, row.outcome === "success" ? "done" : "attention")}</td><td>${escapeHtml(row.actor_label)}</td></tr>`).join("") : '<tr><td colspan="5">조회된 활동이 없습니다.</td></tr>'}</tbody></table></div>
    <div class="actions"><a class="button button-soft" href="#${dashboardRoute("/staff/logs", { action: filtered, outcome })}">최신 기록</a>
    ${auditPage.next ? `<a class="button button-soft" href="#${dashboardRoute("/staff/logs", { action: filtered, outcome, before: String(auditPage.next) })}">이전 기록</a>` : ""}</div>
  </div>`;
}

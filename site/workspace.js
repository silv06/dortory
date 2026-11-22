let portalState = { authenticated: false };
let adminState = { authenticated: false, allowed: false, active: false };
let adminDatabase = emptyWorkspace();
let userDatabase = emptyWorkspace();
let registryAvailability;
let workspaceRevision = 0;
let workspaceMessage = "";
let workspaceConflict = false;
let writingWorkspace = false;
let writingCaseStep = false;
let pendingWorkspace = null;

async function requestSite(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", signal: AbortSignal.timeout(14000), ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "사이트 연결을 확인해 주세요.");
    error.status = response.status;
    throw error;
  }
  return body;
}

function sendSite(path, method, body = {}) {
  return requestSite(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function isStaffPath(path) {
  return path === "/staff" || path.startsWith("/staff/");
}

function workspaceBanner() {
  return `<div id="workspace-status" class="workspace-status" role="status"${workspaceMessage ? "" : " hidden"}>
    <span>${escapeHtml(workspaceMessage)}</span>
    ${workspaceConflict ? '<button class="button button-soft" type="button" data-action="workspace-latest">최신 기록 열기</button>'
      : pendingWorkspace && !writingWorkspace ? '<button class="button button-soft" type="button" data-action="workspace-retry">다시 저장</button>' : ""}
  </div>`;
}

function showWorkspaceMessage(message = "") {
  workspaceMessage = message;
  const banner = document.getElementById("workspace-status");
  if (banner) banner.outerHTML = workspaceBanner();
}

function clearAdministrator() {
  adminState.active = false;
  adminDatabase = emptyWorkspace();
  registryAvailability = undefined;
  officialSessions.clear();
  pendingWorkspace = null;
  workspaceConflict = false;
}

async function loadWorkspace({ refreshSources = false } = {}) {
  const result = await requestSite("/api/workspace" + (refreshSources ? "?refresh=1" : ""));
  workspaceRevision = result.revision;
  adminDatabase = result.database;
  registryAvailability = result.availability;
  workspaceConflict = false;
  pendingWorkspace = null;
  showWorkspaceMessage();
}

async function checkAdministrator() {
  adminState = await requestSite("/api/admin/session");
  if (!adminState.active) clearAdministrator();
  else if (!pendingWorkspace && !writingWorkspace && !writingCaseStep) await loadWorkspace();
}

async function loadUserCases() {
  try {
    const result = await requestSite("/api/user/cases");
    userDatabase.cases = result.cases;
  } catch (error) {
    if (error.status === 401) userDatabase = emptyWorkspace();
    else throw error;
  }
}

async function loadRouteData(path) {
  if (isStaffPath(path)) {
    await checkAdministrator();
    if (adminState.active && path === "/staff/logs") await loadAuditPage(readRoute().params);
  }
  else {
    if (window.dortoryVercel) portalState = await requestSite("/api/admin/session");
    if (path === "/my-case" || path === "/apply/complete") await loadUserCases();
  }

}

async function enterAdministrator(button) {
  button.disabled = true;
  const errorBox = document.getElementById("admin-login-feedback");
  errorBox.textContent = "";
  try {
    await sendSite("/api/admin/session", "POST");
    await checkAdministrator();
    if (!adminState.active) throw new Error("관리자 쿠키를 확인할 수 없습니다. 사이트를 다시 열어 주세요.");
    render(true);
  } catch (error) {
    if (errorBox.isConnected) errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function leaveAdministrator() {
  if (pendingWorkspace || writingWorkspace || writingCaseStep) {
    announce("저장이 끝난 다음 로그아웃할 수 있습니다.");
    return;
  }
  if (!discardEdits([...dirtyForms])) return;
  try {
    await sendSite("/api/admin/session", "DELETE");
    if (dialog.open) dialog.close();
    clearAdministrator();
    render(true);
    announce("관리자 세션을 종료했습니다.");
  } catch (error) {
    announce(error.message);
  }
}

function enqueueWorkspace(value) {
  pendingWorkspace = value;
  void saveWorkspace();
}

async function saveWorkspace() {
  if (!adminState.active || writingWorkspace || !pendingWorkspace || workspaceConflict) return;
  writingWorkspace = true;
  const saving = pendingWorkspace;
  showWorkspaceMessage("사이트에 저장하는 중…");
  try {
    const result = await sendSite("/api/workspace", "PUT", { revision: workspaceRevision, database: saving });
    workspaceRevision = result.revision;
    if (pendingWorkspace === saving) pendingWorkspace = null;
    writingWorkspace = false;
    showWorkspaceMessage();
    if (pendingWorkspace) void saveWorkspace();
  } catch (error) {
    writingWorkspace = false;
    if (error.status === 403) {
      try {
        adminState = await requestSite("/api/admin/session");
        render();
        announce("관리자 세션이 끝났습니다. 다시 로그인한 뒤 변경을 확인해 주세요.");
      } catch { showWorkspaceMessage("관리자 로그인 상태를 확인해 주세요."); }
      return;
    }
    workspaceConflict = error.status === 409;
    showWorkspaceMessage(workspaceConflict
      ? "다른 요청에서 기록이 변경됐습니다. 최신 기록을 연 뒤 다시 적용해 주세요."
      : "사이트에 저장하지 못했습니다. 이 창에서 다시 저장해 주세요.");
  }
}

async function reloadWorkspace(refreshSources = false) {
  if (writingWorkspace || writingCaseStep || !discardEdits([...dirtyForms])) return;
  if (pendingWorkspace && !window.confirm("이 창의 미저장 내용을 지우고 사이트의 최신 기록을 열까요?")) return;
  try {
    await loadWorkspace({ refreshSources });
    render();
  } catch (error) {
    showWorkspaceMessage(error.message);
  }
}

async function sendUserCase(action, fields = {}) {
  const { record } = await sendSite("/api/user/cases", "POST", { action, ...fields });
  userDatabase.cases = [record, ...userDatabase.cases.filter((item) => item.id !== record.id)];
  return record;
}

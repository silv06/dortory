const main = document.getElementById("main");
const header = document.getElementById("header");
const feedback = document.getElementById("feedback");
const dialog = document.getElementById("resource-dialog");
const skipLink = document.getElementById("skip-link");

let uiLanguage = "ko";
let database = emptyWorkspace();
let context = {};
let feedbackTimeout;
let revealObserver;
let lastHash = location.hash;
let routeMessage = "";
const trackedForms = new Set(["apply-form", "field-assist-form", "draft-form", "checklist-form", "resource-form",
  "visit-form", "staff-visit-form", "visit-result-form", "rag-match-form", "aftercare-form"]);
const dirtyForms = new Set();

function stored(key, fallback = "", session = false) {
  try {
    return (session ? sessionStorage : localStorage).getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function remember(key, value, session = false) {
  try {
    const storage = session ? sessionStorage : localStorage;
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // The loaded page can still be explored if storage is unavailable.
  }
}

function update(change) {
  if (!context.isStaff || !adminState.active || writingCaseStep) return false;
  const next = structuredClone(adminDatabase);
  const result = change(next);
  if (result === false) return false;
  adminDatabase = next;
  database = next;
  enqueueWorkspace(next);
  return result;
}

function currentRecord() {
  return database.cases.find((item) => item.id === context.caseId);
}

function appendHistory(record, kind, detail = "") {
  record.history.push({ kind, detail, at: new Date().toISOString() });
}

function workerSession() {
  return stored("finder-worker", "", true);
}

function readRoute() {
  const fragment = location.hash.slice(1);
  const legacy = fragment === "matching-map" ? "/dashboard" : fragment === "schedule" ? "/dashboard/schedule" : "/";
  const hash = fragment.startsWith("/") ? fragment : legacy;
  const [path, search = ""] = hash.split("?");
  const params = new URLSearchParams(search);
  if (path === "/staff/register") {
    params.set("intake", "open");
    return { path: "/staff", params };
  }
  return { path, params };
}

function go(path, message = "") {
  const destination = `#${path}`;
  if (location.hash === destination) {
    render(true);
    if (message) announce(message);
  } else {
    routeMessage = message;
    location.hash = destination;
  }
}

function clearFeedback() {
  clearTimeout(feedbackTimeout);
  feedback.textContent = "";
}

function announce(message) {
  clearFeedback();
  feedback.textContent = message;
  feedbackTimeout = setTimeout(() => { feedback.textContent = ""; }, 4800);
}

function formError(form, message, fieldName) {
  const sharedMessage = form.querySelector("[data-error]");
  const invalidControl = fieldName && form.elements.namedItem(fieldName);
  if (invalidControl instanceof HTMLElement) {
    let fieldMessage = document.getElementById(`${invalidControl.id}-error`);
    if (!fieldMessage) {
      fieldMessage = document.createElement("p");
      fieldMessage.id = `${invalidControl.id}-error`;
      fieldMessage.className = "form-error";
      fieldMessage.setAttribute("aria-live", "polite");
      invalidControl.after(fieldMessage);
    }
    fieldMessage.textContent = message;
    invalidControl.setAttribute("aria-invalid", "true");
    invalidControl.setAttribute("aria-describedby", fieldMessage.id);
    invalidControl.focus();
  } else sharedMessage.textContent = message;
}

function discardEdits(formIds) {
  if (!formIds.some((id) => dirtyForms.has(id))) return true;
  if (!window.confirm(label("저장하지 않은 입력을 지우고 이동할까요?", "Rời khỏi và bỏ các thay đổi chưa lưu?"))) return false;
  for (const id of formIds) dirtyForms.delete(id);
  return true;
}

function render(moveFocus = false, { slide = moveFocus } = {}) {
  const { path, params } = readRoute();
  const isStaff = isStaffPath(path);
  const entered = isStaff && adminState.active;
  database = isStaff ? (entered ? adminDatabase : emptyWorkspace()) : userDatabase;
  const landing = path === "/";
  const browserLanguage = navigator.languages[0]?.toLowerCase().startsWith("vi") ? "vi" : "ko";
  uiLanguage = isStaff ? "ko" : stored("finder-language", browserLanguage);
  document.documentElement.lang = uiLanguage;
  skipLink.textContent = label("본문으로 건너뛰기", "Bỏ qua đến nội dung");
  document.body.dataset.page = landing ? "home" : "workspace";
  header.innerHTML = isStaff ? staffHeader(entered) + workspaceBanner() : publicHeader();
  context = { path, params, isStaff: entered, caseId: "" };
  main.innerHTML = landing ? homePage() : workspaceContent(path, params, isStaff, entered);
  document.body.dataset.task = context.caseTab ?? "";
  updateRagStatus();
  if (slide && !landing) document.getElementById("workspace-panel").classList.add("is-sliding");
  connectMatchMaps();

  const title = main.querySelector("h1");
  document.title = landing || !title ? siteName : `${title.textContent} | ${siteName}`;
  if (landing) activateReveals();
  else revealObserver?.disconnect();

  if (moveFocus && title) {
    window.scrollTo(0, 0);
    const candidate = params.has("candidate") && main.querySelector(".is-map-selected");
    const target = candidate || title;
    target.tabIndex = -1;
    target.focus({ preventScroll: !candidate });
  }
}

function workspaceContent(path, params, staff, entered) {
  const area = chosenArea(params);
  const candidate = params.get("candidate") || "";
  let panel;
  let map = "";
  if (staff && !entered) {
    panel = staffEntryPage();
  } else if (path === "/apply") {
    panel = applyPage(area || "janghang");
    map = workContextMap(area || "janghang");
  } else if (staff && path === "/staff/logs") {
    panel = adminLogPage(params);
  } else if (staff && path.startsWith("/staff/resources")) {
    const type = path.endsWith("/transits") ? "transits" : "homes";
    const selected = chosenArea(params, type === "homes" ? HOME_GROUPS : WORK_AREAS);
    panel = staffResources(database, type, selected, params);
  } else if (staff && path.startsWith("/staff/cases/")) {
    const [, , , id, requested] = path.split("/");
    const record = database.cases.find((item) => item.id === id);
    if (record) {
      context.caseId = record.id;
      const permitted = caseStepUnlocked(record, requested) || requested === "history"
        || (requested === "aftercare" && caseCanUseAftercare(record));
      const step = permitted ? requested : currentCaseStep(record);
      context.caseTab = step;
      if (requested && requested !== step) {
        context.path = `/staff/cases/${record.id}/${step}`;
        lastHash = "#" + context.path;
        history.replaceState(history.state, "", lastHash);
      }
      panel = staffCase(record, database, step, stored("finder-inbox-route", "/staff", true));
    } else panel = '<div class="wrap page">' + pageHead("상담을 찾을 수 없습니다", "업무함의 상담 목록을 확인해 주세요.", '<a class="button" href="#/staff">업무함 열기</a>') + "</div>";
  } else if (staff) {
    const filter = Object.hasOwn(STAFF_FILTERS, params.get("filter")) ? params.get("filter") : "all";
    panel = staffDashboard(database, filter, area, params.get("intake") === "open");
    map = staffWorkspaceMap(database, filter, area);
    remember("finder-inbox-route", dashboardRoute("/staff", { area, filter }), true);
  } else if (path === "/my-case" || path === "/apply/complete") {
    const record = database.cases.find((item) => item.id === workerSession());
    if (record) context.caseId = record.id;
    panel = !record ? accessPage(database.cases) : path === "/apply/complete" ? confirmationPage(record)
      : workerCasePage(record, database, candidate, params.get("tab"));
  } else {
    panel = publicOverview(area);
    map = publicWorkspaceMap(area);
  }
  return dashboardFrame(path, staff, entered, map, panel);
}

function syncApplicationMap(form) {
  if (context.path !== "/apply") return;
  const map = document.getElementById("workspace-map");
  if (!map || !Object.hasOwn(WORK_AREAS, form.elements.area.value)) return;
  map.innerHTML = workContextMap(form.elements.area.value);
  connectMatchMaps();
}

function activateReveals() {
  revealObserver?.disconnect();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("entered");
      observer.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -25px 0px" });
  for (const element of main.querySelectorAll("[data-enter]")) revealObserver.observe(element);
}

function refresh(message, selector) {
  const forms = [...dirtyForms].map((id) => [id, document.getElementById(id)]).filter(([, form]) => form);
  const values = forms.map(([id, form]) => [id, [...form.elements].filter((element) => element.name)
    .map((element) => ({ name: element.name, value: element.value, checked: element.checked, type: element.type }))]);
  render(false, { slide: true });
  for (const [id, details] of values) {
    const form = document.getElementById(id);
    if (!form) continue;
    for (const field of details) {
      const control = [...form.elements].find((item) => item.name === field.name && (field.type !== "checkbox" || item.value === field.value));
      if (control && field.type === "checkbox") control.checked = field.checked;
      else if (control) control.value = field.value;
    }
  }
  const target = selector ? main.querySelector(selector) : main.querySelector("h1");
  if (target) {
    if (target.matches("h1, h2")) target.tabIndex = -1;
    target.focus({ preventScroll: !selector });
  }
  if (message) announce(message);
}

async function submitApplication(form, values, button) {
  if (values.moveOut <= values.moveIn) {
    formError(form, label("거주 종료일을 입주일보다 뒤로 선택해 주세요.", "Chọn ngày rời đi sau ngày vào ở."), "moveOut");
    return;
  }
  if (!values.alias.trim() || values.workFrom === values.workTo) {
    formError(form, label("별칭과 근무 시작·종료 시각을 확인해 주세요.", "Kiểm tra tên và giờ làm việc."));
    return;
  }
  if (form.dataset.staff === "true") {
    if (!context.isStaff) return;
    await submitFieldApplication(form, values, button);
    return;
  }
  button.disabled = true;
  try {
    form.dataset.requestId ||= crypto.randomUUID();
    const record = await sendUserCase("create", { fields: values, requestId: form.dataset.requestId });
    dirtyForms.delete(form.id);
    remember("finder-worker", record.id, true);
    go("/apply/complete");
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitFieldApplication(form, fields, button) {
  if (pendingWorkspace || writingWorkspace || writingCaseStep) {
    formError(form, "앞서 변경한 기록을 저장한 뒤 현장 상담을 등록해 주세요.");
    return;
  }
  form.dataset.requestId ||= crypto.randomUUID();
  form.setAttribute("aria-busy", "true");
  const controls = [...form.elements].filter((control) => !control.disabled);
  for (const control of controls) control.disabled = true;
  const originalLabel = button.innerHTML;
  button.textContent = "저장 중…";
  try {
    const { id } = await sendSite("/api/workspace", "POST", { fields, requestId: form.dataset.requestId });
    if (!form.isConnected) return;
    dirtyForms.delete(form.id);
    dirtyForms.delete("field-assist-form");
    go(`/staff/cases/${id}/info`, "현장 상담을 등록했습니다.");
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
  } finally {
    form.removeAttribute("aria-busy");
    for (const control of controls) control.disabled = false;
    button.innerHTML = originalLabel;
  }
}

async function startMatchingDemo(button) {
  if (pendingWorkspace || writingWorkspace || writingCaseStep || dirtyForms.size) {
    announce("변경한 내용을 먼저 저장한 뒤 시연을 시작해 주세요.");
    return;
  }
  writingCaseStep = true;
  button.disabled = true;
  button.dataset.requestId ||= crypto.randomUUID();
  try {
    const { id } = await sendSite("/api/workspace", "POST", {
      action: "start-matching-demo", requestId: button.dataset.requestId,
    });
    if (button.isConnected) go(`/staff/cases/${id}/compare`);
  } catch (error) {
    if (button.isConnected) announce(error.message);
  } finally {
    writingCaseStep = false;
    button.disabled = false;
  }
}

async function submitAccess(form, values, button) {
  if (!dialog.open || button.disabled) return;
  const closeButton = form.querySelector(".close-button");
  form.setAttribute("aria-busy", "true");
  closeButton.disabled = true;
  button.disabled = true;
  try {
    const record = await sendUserCase("claim", { id: values.caseCode.trim().toUpperCase(), pin: values.casePin.trim().toUpperCase() });
    if (form.isConnected && dialog.open) {
      dialog.close();
      openOwnCase(record.id);
    }
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
  } finally {
    form.removeAttribute("aria-busy");
    closeButton.disabled = false;
    button.disabled = false;
  }
}

function openOwnCase(id) {
  if (!userDatabase.cases.some((item) => item.id === id)) return;
  remember("finder-worker", id, true);
  go("/my-case");
}

function editCurrent(edit, options) {
  const id = context.caseId;
  const result = update((next) => {
    const record = next.cases.find((item) => item.id === id);
    return record ? edit(record, next) : false;
  });
  if (!result) {
    announce(label("상담 상태가 바뀌었습니다. 확인 후 다시 시도해 주세요.", "Hồ sơ đã thay đổi. Hãy kiểm tra và thử lại."));
    return false;
  }
  if (options?.close && dialog.open) dialog.close();
  if (options?.route) {
    go(`/staff/cases/${id}/${options.route}`, options.message);
  } else if (options?.candidate) {
    go(dashboardRoute(context.path, { candidate: options.candidate }), options.message);
  } else refresh(options?.message, options?.focus);
  return true;
}

const CASE_STEP_MESSAGES = {
  "confirm-intake": "상담 정보를 확인했습니다.",
  "select-housing": "선택한 주택과 통근 조합을 저장했습니다.",
  "finish-ai-review": "AI 도토리 검토를 확인했습니다.",
  "prepare-visit": "입주 서류 준비를 확인했습니다.",
  "schedule-visit": "현장 방문 일정을 접수했습니다.",
  "confirm-contract": "방문·계약 확인을 기록했습니다.",
  "record-submission": "제출 결과를 기록했습니다.",
  "confirm-move": "입주 확인을 기록했습니다.",
};

async function advanceCase(action, button, fields = {}, form = null) {
  const record = currentRecord();
  if (!record || !context.isStaff || !button) return;
  const alert = (message) => form?.isConnected ? formError(form, message) : announce(message);
  if (writingCaseStep || pendingWorkspace || writingWorkspace) return alert("앞서 변경한 내용을 저장한 뒤 진행해 주세요.");
  if ([...dirtyForms].some((id) => id !== form?.id)) return alert("다른 입력란에서 변경한 내용을 먼저 저장해 주세요.");
  const path = context.path;
  const revision = workspaceRevision;
  button.disabled = true;
  writingCaseStep = true;
  try {
    const result = await sendSite("/api/workspace", "POST", { ...fields, action, id: record.id, revision });
    if (!adminState.active) return;
    if (workspaceRevision === revision) {
      workspaceRevision = result.revision;
      adminDatabase.cases = adminDatabase.cases.map((item) => item.id === result.record.id ? result.record : item);
    }
    if (context.path !== path) return;
    if (form) dirtyForms.delete(form.id);
    go(`/staff/cases/${record.id}/${currentCaseStep(result.record)}`, CASE_STEP_MESSAGES[action]);
  } catch (error) {
    if (context.path === path) {
      if (error.status === 409) {
        workspaceConflict = true;
        showWorkspaceMessage(error.message);
      }
      alert(error.message);
    }
  } finally {
    writingCaseStep = false;
    button.disabled = false;
  }
}

function startVisit(button) {
  const record = currentRecord();
  if (!record || record.stage !== "visitReady") return;
  const match = record.offers.find((item) => item.homeId === button.dataset.home && item.transitId === button.dataset.transit);
  const offer = match && latestProposal(match, database);
  if (offer) openDialog(visitEditor(offer.home, offer.route), "visitDate");
}

async function submitVisit(form, values, button) {
  const id = currentRecord()?.id;
  if (!id) return;
  button.disabled = true;
  try {
    await sendUserCase("visit", { id, homeId: form.dataset.home, transitId: form.dataset.transit, date: values.visitDate, slot: values.visitTime });
    dirtyForms.delete(form.id);
    dialog.close();
    refresh(label("방문 요청을 보냈습니다.", "Đã gửi yêu cầu xem nhà."));
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
  } finally {
    button.disabled = false;
  }
}

function saveDraft(form, values) {
  if (!values.housingText.trim() || !values.terms.trim()) {
    formError(form, "주택과 계약 조건을 입력한 뒤 저장해 주세요.", !values.housingText.trim() ? "housingText" : "terms");
    return;
  }
  editCurrent((record) => {
    if (!canEditCaseDocuments(record)) return false;
    record.docs.draft = { ...values, dateType: record.stage === "preparing" ? "planned" : "confirmed" };
    dirtyForms.delete(form.id);
    appendHistory(record, "draftSaved");
    return true;
  }, { message: "서류 초안을 저장했습니다.", focus: "#housingText" });
}

function handleChecklist(form, button) {
  const action = button?.value || "save";
  const data = new FormData(form);
  const checked = data.getAll("documents").filter((key) => Object.hasOwn(DOC_ITEMS, key));
  const missing = Object.keys(DOC_ITEMS).filter((key) => !checked.includes(key));
  const record = currentRecord();
  if (!record || !canEditCaseDocuments(record)) return;
  if (action === "prepare") {
    void advanceCase("prepare-visit", button, { checked }, form);
    return;
  }
  if (action === "request" && !missing.length) {
    formError(form, "보완 요청이 필요한 항목의 확인 표시를 해제해 주세요.");
    return;
  }
  editCurrent((item) => {
    if (!canEditCaseDocuments(item)) return false;
    item.docs.checked = checked;
    if (action === "request") {
      item.docs.requested = missing;
      item.docs.acknowledged = false;
      item.docs.supplied = item.docs.supplied.filter((key) => !missing.includes(key));
      appendHistory(item, "requested", missing.map((key) => DOC_ITEMS[key].ko).join(", "));
    } else {
      item.docs.requested = item.docs.requested.filter((key) => !checked.includes(key));
      appendHistory(item, "checked");
    }
    dirtyForms.delete(form.id);
    return true;
  }, { message: action === "request" ? "이용자에게 보완 요청을 보냈습니다." : "확인 항목을 저장했습니다." });
}

async function acknowledgeDocuments(button) {
  const id = currentRecord()?.id;
  if (!id) return;
  button.disabled = true;
  try {
    await sendUserCase("acknowledge", { id });
    refresh(label("요청받은 항목을 확인했습니다.", "Đã xem các mục cần bổ sung."));
  } catch (error) {
    announce(error.message);
  } finally {
    button.disabled = false;
  }
}

async function sendExistingReceipt(button) {
  const record = currentRecord();
  if (!record?.receipt?.retryable) return;
  button.disabled = true;
  try {
    const updated = await sendUserCase("receipt", { id: record.id });
    const message = updated.receipt?.state === "sent"
      ? label("접수 안내 메일을 발송했습니다.", "Đã gửi email xác nhận.")
      : label("접수 안내 메일의 상태를 확인해 주세요.", "Hãy kiểm tra trạng thái email xác nhận.");
    refresh(message);
    const details = main.querySelector(".receipt-details");
    if (details) details.open = true;
  } catch (error) {
    announce(error.message);
  } finally {
    button.disabled = false;
  }
}

async function submitAftercareRequest(form, values, button) {
  const record = currentRecord();
  if (!record || !caseCanUseAftercare(record)) return;
  button.disabled = true;
  try {
    form.dataset.requestId ||= crypto.randomUUID();
    await sendUserCase("aftercare", {
      id: record.id, requestId: form.dataset.requestId, category: values.aftercareCategory, message: values.aftercareMessage,
    });
    dirtyForms.delete(form.id);
    refresh(label("사후관리 요청을 접수했습니다.", "Đã tiếp nhận yêu cầu hỗ trợ."));
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
  } finally {
    button.disabled = false;
  }
}

function saveAftercareReply(form, values) {
  const ticketId = form.dataset.aftercareTicket;
  const status = values["status-" + ticketId];
  const message = (values["reply-" + ticketId] || "").trim();
  const current = currentRecord();
  const ticket = current?.aftercare?.find((item) => item.id === ticketId);
  if (!current || !caseCanUseAftercare(current) || !ticket || !Object.hasOwn(AFTERCARE_STATES, status) || message.length > 800) {
    formError(form, "사후관리 요청과 답변을 확인해 주세요.");
    return;
  }
  if (ticket.status === status && !message) {
    formError(form, "처리 상태를 바꾸거나 이용자에게 보낼 답변을 입력해 주세요.");
    return;
  }
  editCurrent((record) => {
    const target = record.aftercare.find((item) => item.id === ticketId);
    if (!target) return false;
    target.status = status;
    target.updates.unshift({ status, message, at: new Date().toISOString() });
    appendHistory(record, "aftercareUpdated", AFTERCARE_TYPES[target.category].ko + " · " + AFTERCARE_STATES[status].ko);
    dirtyForms.delete(form.id);
    return true;
  }, { message: "사후관리 상태와 답변을 저장했습니다." });
}

function openDialog(markup, focusId) {
  dialog.innerHTML = markup;
  dialog.showModal();
  document.getElementById(focusId)?.focus();
}

function resourceSave(form, values) {
  const { type, id } = form.dataset;
  const home = type === "homes";
  if (!["homes", "transits"].includes(type)) return;
  if (!values.resourceName.trim()) {
    formError(form, "대장에 표시할 이름을 입력해 주세요.", "resourceName");
    return;
  }
  const ready = values.resourceReady === "on";
  const optionalNumber = (value) => value === "" ? null : Number(value);
  const address = home ? values.resourceAddress.trim() : "";
  const linked = home ? null : database.homes.find((item) => item.id === values.resourceHomeId);
  if (home && values.resourceFrom && values.resourceUntil && values.resourceUntil < values.resourceFrom) {
    formError(form, "계약 종료일을 입주 가능일 이후로 수정해 주세요.", "resourceUntil");
    return;
  }
  if (home && ready && (!address || address.includes("*"))) {
    formError(form, "임대가 확인된 주택의 정확한 주소를 입력해 주세요.", "resourceAddress");
    return;
  }
  if (home && ready && [values.resourceFrom, values.resourceUntil, values.resourcePlaces, values.resourceDeposit,
    values.resourceRent, values.resourceBills].some((value) => !value)) {
    formError(form, "임대 확인에 필요한 입주 가능 기간·인원·비용을 모두 입력해 주세요.");
    return;
  }
  if (!home && ready && (!linked || [values.resourceOutbound, values.resourceArrival, values.resourceInbound,
    values.resourceWalk, values.resourceSeats, values.resourceCost, values.resourceOwner.trim()].some((value) => !value))) {
    formError(form, "연결 주택·왕복 시각·보행 시간·좌석·요금·확인 근거를 입력해 주세요.");
    return;
  }
  const checked = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const saved = update((next) => {
    const rows = next[type];
    const position = rows.findIndex((item) => item.id === id);
    const current = rows[position] ?? {};
    const prefix = home ? "H" : "T";
    const nextNumber = Math.max(0, ...rows.map((item) => Number(item.id.match(new RegExp("^" + prefix + "-(\\d+)$"))?.[1] ?? 0))) + 1;
    const newId = id || `${prefix}-${String(nextNumber).padStart(2, "0")}`;
    const item = {
      ...current, id: newId, name: values.resourceName.trim(), origin: "registered", ready, checked,
      ...(home ? {
        area: values.resourceArea, from: values.resourceFrom, until: values.resourceUntil, address,
        places: optionalNumber(values.resourcePlaces), deposit: optionalNumber(values.resourceDeposit),
        rent: optionalNumber(values.resourceRent), bills: optionalNumber(values.resourceBills),
      } : {
        homeId: linked?.id || "", home: linked?.area || current.home || "", work: values.resourceWork,
        outbound: values.resourceOutbound, arrival: values.resourceArrival, inbound: values.resourceInbound,
        walk: optionalNumber(values.resourceWalk), seats: optionalNumber(values.resourceSeats),
        cost: optionalNumber(values.resourceCost), owner: values.resourceOwner.trim(), mode: values.resourceMode,
        rideHome: optionalNumber(values.resourceRideHome), transfers: optionalNumber(values.resourceTransfers),
      }),
    };
    if (position === -1) rows.unshift(item);
    else rows[position] = item;
    return true;
  });
  if (!saved) return;
  dirtyForms.delete(form.id);
  dialog.close();
  refresh("대장에 저장했습니다.");
}

const commonActions = {
  "admin-logout": () => void leaveAdministrator(),
  "workspace-retry": () => void saveWorkspace(),
  "workspace-latest": () => void reloadWorkspace(),
  "add-field-case": () => openDialog(fieldCaseEditor(), "caseCode"),
  "open-own-case": (button) => openOwnCase(button.dataset.id),
  "sign-out-case": () => {
    remember("finder-worker", "", true);
    go("/my-case");
  },
  "close-resource": () => {
    if (discardEdits(["resource-form", "visit-form"])) dialog.close();
  },
  "request-visit": (button) => {
    if (!context.isStaff && context.caseId === workerSession()) startVisit(button);
  },
  "acknowledge-documents": (button) => {
    if (!context.isStaff && context.caseId === workerSession()) void acknowledgeDocuments(button);
  },
  "send-receipt": (button) => {
    if (!context.isStaff && context.caseId === workerSession()) void sendExistingReceipt(button);
  },
};

const staffActions = {
  "field-memo-example": fillFieldExample,
  "start-matching-demo": (button) => void startMatchingDemo(button),
  "confirm-intake": (button) => void advanceCase("confirm-intake", button),
  "select-housing": (button) => void advanceCase("select-housing", button, {
    homeId: button.dataset.home, transitId: button.dataset.transit,
  }),
  "finish-ai-review": (button) => void advanceCase("finish-ai-review", button),
  "confirm-contract": (button) => void advanceCase("confirm-contract", button),
  "confirm-move": (button) => void advanceCase("confirm-move", button),
  "refresh-catalog": () => void reloadWorkspace(true),
  "issue-access-code": () => editCurrent((record) => {
    if (record.accountId || record.channel !== "field") return false;
    record.pin = caseAccessCode();
    return true;
  }, { message: "새 상담 연결 코드를 발급했습니다." }),
  "official-prefill": fillOfficialFields,
  "official-save": () => saveOfficialFields(),
  "official-read": () => extractOfficialFields(),
  "official-example": () => fillOfficialExample(),
  "official-clear-example": () => clearOfficialExample(),
  resource: (button) => {
    const type = button.dataset.type;
    if (!["homes", "transits"].includes(type)) return;
    const item = database[type].find((row) => row.id === button.dataset.id);
    openDialog(resourceEditor(type, item), "resourceName");
  },
};

document.addEventListener("click", (event) => {
  const mapView = event.target.closest("button[data-map-view]");
  if (mapView) {
    toggleMatchMapView(mapView);
    return;
  }
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const name = button.dataset.action;
  if (name === "account-logout") {
    if (!discardEdits([...dirtyForms])) return;
    void fetch("/auth/logout", { method: "POST" }).then((response) => { if (response.ok) { location.hash = "/dashboard"; location.reload(); } else announce("로그아웃을 다시 시도해 주세요."); }).catch(() => announce("로그아웃을 다시 시도해 주세요."));
    return;
  }
  const action = commonActions[name] || (context.isStaff ? staffActions[name] : undefined);
  action?.(button);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const button = event.submitter || form.querySelector('button[type="submit"]');
  if (form.id === "admin-login-form") void enterAdministrator(button);
  else if (form.id === "apply-form") void submitApplication(form, values, button);
  else if (form.id === "field-assist-form" && context.isStaff) fillFieldDraft(form, values.memo);
  else if (form.id === "access-form") void submitAccess(form, values, button);
  else if (form.id === "visit-form" && context.caseId === workerSession()) void submitVisit(form, values, button);
  else if (form.id === "aftercare-form" && !context.isStaff && context.caseId === workerSession()) void submitAftercareRequest(form, values, button);
  else if (context.isStaff) {
    if (form.id.startsWith("rag-")) submitRag(form, values, event.submitter);
    else if (form.id === "official-form") void downloadOfficialForm(form, event.submitter);
    else if (form.id === "draft-form") saveDraft(form, values);
    else if (form.id === "checklist-form") handleChecklist(form, button);
    else if (form.id === "staff-visit-form") void advanceCase("schedule-visit", button, {
      date: values.staffVisitDate, slot: values.staffVisitSlot,
    }, form);
    else if (form.id === "visit-result-form") void advanceCase("record-submission", button, {
      outcome: values.visitOutcome, checked: currentRecord()?.docs.checked,
    }, form);
    else if (form.id === "resource-form") resourceSave(form, values);
    else if (form.id === "audit-filter") go(dashboardRoute("/staff/logs", { action: values.auditAction, outcome: values.auditOutcome }));
    else if (form.id === "registry-filter") go(dashboardRoute(context.path, { area: values.area, q: values.q.trim(), status: values.status }));
    else if (form.dataset.aftercareTicket) saveAftercareReply(form, values);
  }
});

document.addEventListener("input", (event) => {
  const field = event.target;
  if (!field.form) return;
  if (field.form.id === "apply-form") delete field.dataset.assistValue;
  if (field.form.id === "field-assist-form") {
    const status = field.form.querySelector("[data-field-result]");
    if (status.textContent) status.textContent = "메모를 수정했습니다. 항목을 다시 채워 변경 내용을 반영할 수 있습니다.";
    field.form.querySelector("[data-field-review]").hidden = true;
  }
  if (field.form.id === "official-form") rememberOfficialFields(field.form);
  if (trackedForms.has(field.form.id) || field.form.dataset.aftercareTicket) dirtyForms.add(field.form.id);
  field.removeAttribute("aria-invalid");
  const fieldMessage = document.getElementById(`${field.id}-error`);
  if (fieldMessage) fieldMessage.textContent = "";
  if (field.getAttribute("aria-describedby") === fieldMessage?.id) field.removeAttribute("aria-describedby");
  const message = field.form.querySelector("[data-error]");
  if (message) message.textContent = "";
});

document.addEventListener("change", (event) => {
  if (event.target.id === "official-kind") {
    renderOfficialEditor();
  } else if (event.target.id === "area" && event.target.form?.id === "apply-form") {
    syncApplicationMap(event.target.form);
  } else if (event.target.dataset.caseMap) {
    const audience = event.target.dataset.caseMap;
    const record = currentRecord();
    const chosen = record && mapOptionsFor(record, database, audience)
      .find((item) => mapOptionKey(item) === event.target.value);
    if (chosen) go(dashboardRoute(context.path, { candidate: mapOptionKey(chosen) }));
  } else if (event.target.id === "site-language") {
    const form = document.getElementById("apply-form");
    const values = form ? [...new FormData(form)] : [];
    remember("finder-language", event.target.value === "vi" ? "vi" : "ko");
    clearFeedback();
    render(false, { slide: true });
    const replacement = form && document.getElementById(form.id);
    if (replacement) {
      for (const [name, value] of values) {
        const control = replacement.elements.namedItem(name);
        if (control?.type === "checkbox") control.checked = true;
        else if (control) control.value = value;
      }
      syncApplicationMap(replacement);
    }
    document.getElementById("site-language")?.focus({ preventScroll: true });
  }
});

skipLink.addEventListener("click", (event) => {
  event.preventDefault();
  main.focus({ preventScroll: true });
  main.scrollIntoView({ block: "start" });
});
window.addEventListener("hashchange", async () => {
  if (!discardEdits([...dirtyForms])) {
    routeMessage = "";
    history.replaceState(history.state, "", lastHash || location.pathname + location.search);
    return;
  }
  const destination = location.hash;
  lastHash = destination;
  clearFeedback();
  if (dialog.open) dialog.close();
  try { await loadRouteData(readRoute().path); }
  catch { showWorkspaceMessage("사이트에 저장된 기록을 불러오지 못했습니다."); }
  if (location.hash !== destination) return;
  render(true);
  if (routeMessage) announce(routeMessage);
  routeMessage = "";
});
dialog.addEventListener("cancel", (event) => {
  if (dialog.querySelector("#access-form[aria-busy]") || !discardEdits(["resource-form", "visit-form"])) event.preventDefault();
});
dialog.addEventListener("close", () => {
  if (!dialog.open) dialog.querySelector("#access-form")?.remove();
});
window.addEventListener("beforeunload", (event) => {
  if (dirtyForms.size || pendingWorkspace) {
    event.preventDefault();
    event.returnValue = "";
  }
});
main.insertAdjacentHTML("beforeend", '<p class="wrap page" role="status">도토리를 여는 중…</p>');
loadRouteData(readRoute().path).catch(() => {
  showWorkspaceMessage("사이트에 저장된 기록을 불러오지 못했습니다.");
}).finally(() => render());

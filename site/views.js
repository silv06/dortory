const siteName = "dortory (도토리)";
const nextArrow = '<span class="arrow" aria-hidden="true">→</span>';

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (token) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[token]);
}

function label(ko, vi) {
  return uiLanguage === "vi" ? vi : ko;
}

function localize(content) {
  return content?.[uiLanguage] ?? content?.ko ?? "";
}

function money(value) {
  return new Intl.NumberFormat(uiLanguage === "vi" ? "vi-VN" : "ko-KR", {
    style: "currency", currency: "KRW", maximumFractionDigits: 0,
  }).format(value);
}

function displayDate(value, options = {}) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value);
  return new Intl.DateTimeFormat(uiLanguage === "vi" ? "vi-VN" : "ko-KR", {
    timeZone: "Asia/Seoul", month: "short", day: "numeric", ...options,
  }).format(date);
}

function wordmark() {
  return `<a class="wordmark" href="#/" aria-label="${label("도토리 홈", "Trang chủ dortory")}">
    <img class="brand-mark" src="./assets/mark.png" width="1604" height="1497" alt="">
    <strong translate="no">${label("도토리", "dortory")}</strong>
  </a>`;
}

function navLink(route, active, title) {
  return `<a href="#${escapeHtml(route)}"${active ? ' aria-current="page"' : ""}>${title}</a>`;
}

function publicHeader() {
  const adminEntry = portalState.active
    ? label("관리자 업무함", "Bảng quản trị")
    : label("관리자 로그인", "Đăng nhập quản trị");
  return `<header class="site-header public-header">
    <div class="wrap header-inner">
      ${wordmark()}
      <label class="language-field">
        <span class="sr-only">${label("화면 언어", "Ngôn ngữ giao diện")}</span>
        <select id="site-language">
          <option value="ko"${uiLanguage === "ko" ? " selected" : ""}>한국어</option>
          <option value="vi"${uiLanguage === "vi" ? " selected" : ""}>Tiếng Việt</option>
        </select>
      </label>
      <nav aria-label="${label("주 메뉴", "Menu chính")}">
        ${window.dortoryVercel && !portalState.authenticated ? `<a href="/auth/google/start?return_to=${encodeURIComponent("/" + (location.hash || "#/dashboard"))}" target="_top">${label("구글 로그인", "Đăng nhập Google")}</a>` : ""}
        ${window.dortoryVercel && portalState.authenticated ? `<button class="text-button" type="button" data-action="account-logout">${label("로그아웃", "Đăng xuất")}</button>` : ""}
        <a class="button button-soft" href="#/staff">${adminEntry}</a>
      </nav>
    </div>
  </header>`;
}

function staffHeader(active) {
  return `<header class="site-header staff-header">
    <div class="wrap header-inner">
      ${wordmark()}
      <nav aria-label="관리자 메뉴">
        ${navLink("/dashboard", false, "이용자용")}
        ${active ? '<button class="text-button" type="button" data-action="admin-logout">관리자 로그아웃</button>' : ""}
      </nav>
    </div>
  </header>`;
}

function homePage() {
  return `<section class="wrap landing" aria-labelledby="home-title">
    <div class="landing-copy">
      <h1 id="home-title" data-enter>${label("서천에서 살 집,<br>출퇴근길까지", "Nhà ở và đường đi làm<br>tại Seocheon")}</h1>
      <p data-enter>${label("서천에서 일하는 외국인 노동자를 위한 주거 상담입니다. 살 집과 통근편, 입주 서류를 한곳에서 확인하세요.", "Dịch vụ tư vấn cho người lao động nước ngoài tại Seocheon. Xem nhà ở, cách đi làm và hồ sơ vào ở tại đây.")}</p>
      <div class="actions">
        <a class="button" href="#/dashboard">${label("이용자 화면 열기", "Mở trang người dùng")} ${nextArrow}</a>
      </div>
    </div>
    <figure class="landing-media">
      <img class="landing-image" src="./assets/seocheon-harbor.webp" width="1120" height="630" fetchpriority="high" alt="${label("해 질 무렵 서천 포구의 방파제와 마을", "Làng chài và đê chắn sóng ở Seocheon lúc hoàng hôn")}">
      <figcaption><a href="https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=200018&amp;wrtSn=13064531">${label("서천의 포구 · EBS 「한국기행」", "Cảng ở Seocheon · EBS")}</a></figcaption>
    </figure>
  </section>`;
}

function field(caption, id, input, full = false) {
  return `<div class="field${full ? " field-full" : ""}"><label for="${id}">${caption}</label>${input}</div>`;
}

function input(name, type, attrs = "", value = "") {
  return `<input id="${name}" name="${name}" type="${type}" ${attrs}${value !== "" ? ` value="${escapeHtml(value)}"` : ""}>`;
}

function select(name, values, selected, attrs = "") {
  return `<select id="${name}" name="${name}" ${attrs}>${Object.entries(values).map(([value, text]) =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select>`;
}

function areaOptions(areas) {
  return Object.fromEntries(Object.entries(areas).map(([key, name]) => [key, localize(name)]));
}

function pageHead(title, content = "", action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1>${content ? `<p>${content}</p>` : ""}</div>${action}</div>`;
}

function googleLoginCard(title, next, { description, action } = {}) {
  const content = description ?? label("구글 계정으로 로그인하면 상담 접수와 진행 상황을 이어서 확인할 수 있습니다.", "Đăng nhập Google để đăng ký và theo dõi hồ sơ.");
  return `<div class="wrap narrow page">${pageHead(title, content)}
    <a class="button" href="/auth/google/start?return_to=${encodeURIComponent(next)}" target="_top">${action ?? label("구글 계정으로 로그인", "Đăng nhập bằng Google")}</a></div>`;
}
function applyPage(area = "janghang") {
  const title = label("주거 상담 신청", "Đăng ký tư vấn nhà ở");
  if (window.dortoryVercel && !portalState.authenticated) return googleLoginCard(title, "/#/apply?area=" + area);
  return `<div class="wrap narrow page">${pageHead(title)}${applicationForm(false, area)}</div>`;
}

function applicationForm(staff, area) {
  const choices = (values) => staff ? { "": "선택", ...values } : values;
  return `${staff ? fieldIntakeAssistant() : ""}
    <form id="apply-form" class="paper form-panel" data-staff="${staff}">
      ${staff ? '<h2>접수 내용 확인</h2>' : ""}
      <fieldset><legend>${label("상담 방법", "Cách tư vấn")}</legend><div class="form-grid">
        ${field(label("이용자 별칭", "Tên giả"), "alias", input("alias", "text", 'required maxlength="30" autocomplete="off"'))}
        ${field(label("안내받을 언어", "Ngôn ngữ tư vấn"), "locale", select("locale", choices({ ko: "한국어", vi: "Tiếng Việt" }), staff ? "" : uiLanguage, "required"))}
        ${staff ? field("선호 연락 방법", "contact", select("contact", choices({ onsite: "현장 상담", message: "문자 안내" }), "", "required"))
          : field(label("접수 안내를 받을 이메일", "Email nhận thông báo tiếp nhận"), "contactEmail",
            input("contactEmail", "email", 'required maxlength="254" autocomplete="email" spellcheck="false"'))}
      </div></fieldset>
      <fieldset><legend>${label("주거 조건", "Nhu cầu chỗ ở")}</legend><div class="form-grid">
        ${field(label("희망 입주일", "Ngày muốn vào ở"), "moveIn", input("moveIn", "date", "required"))}
        ${field(label("예상 거주 종료일", "Ngày dự kiến rời đi"), "moveOut", input("moveOut", "date", "required"))}
        ${field(label("함께 거주할 인원 (본인 포함)", "Số người ở (gồm bạn)"), "people", input("people", "number", 'required min="1" max="12" inputmode="numeric"', staff ? "" : 1))}
        ${field(staff ? "주거·통근 월 예산(원)" : label("월 예산(원)", "Ngân sách mỗi tháng (won)"), "budget", input("budget", "number", 'required min="1" max="10000000" inputmode="numeric"'))}
      </div></fieldset>
      <fieldset><legend>${label("근무 조건", "Ca làm")}</legend><div class="form-grid">
        ${field(label("근무지", "Nơi làm việc"), "area", select("area", choices(areaOptions(WORK_AREAS)), area, "required"), true)}
        ${field(label("근무 시작", "Bắt đầu ca"), "workFrom", input("workFrom", "time", "required"))}
        ${field(label("근무 종료", "Kết thúc ca"), "workTo", input("workTo", "time", "required"))}
        ${field(label("전달할 내용 (선택)", "Lời nhắn (không bắt buộc)"), "notes",
          '<textarea id="notes" name="notes" rows="3" maxlength="280"></textarea>', true)}
      </div></fieldset>
      <p class="subtle">${staff ? "별칭과 주거·근무 조건은 상담을 위해 사이트에 저장됩니다."
        : label("입력한 이메일은 상담 접수 안내에 사용됩니다. 메모에는 신분증 번호나 연락처를 입력하지 마세요.",
          "Email đã nhập dùng để gửi thông báo tiếp nhận. Không nhập số giấy tờ hoặc thông tin liên hệ vào lời nhắn.")}</p>
      <label class="checkbox-line"><input name="consent" type="checkbox" required><span>${staff ? "이용자에게 상담 기록의 저장과 열람 방법을 안내했습니다." : label("입력한 정보로 상담을 신청합니다.", "Tôi đăng ký tư vấn bằng thông tin đã nhập.")}</span></label>
      <p class="form-error" data-error role="alert"></p>
      <button class="button" type="submit">${staff ? "현장 상담 저장" : label("상담 신청하기", "Gửi yêu cầu tư vấn")} ${nextArrow}</button>
    </form>`;
}

function receiptNotice(record) {
  if (!record.contactEmail || !record.receipt) return "";
  const messages = {
    sent: label("접수 안내 메일을 발송했습니다.", "Đã gửi email xác nhận tiếp nhận."),
    unavailable: label("현재 메일을 발송할 수 없습니다. 내 상담에서 접수 내역을 확인할 수 있습니다.", "Hiện chưa thể gửi email. Bạn có thể xem thông tin tiếp nhận trong Hồ sơ của tôi."),
    queued: label("접수 안내 메일이 발송 대기 중입니다.", "Email xác nhận đang chờ gửi."),
    sending: label("접수 안내 메일을 전송 중입니다.", "Đang gửi email xác nhận."),
    failed: label("접수 안내 메일을 발송하지 못했습니다.", "Không gửi được email xác nhận."),
    unknown: label("접수 안내 메일의 발송 결과를 확인 중입니다.", "Chưa xác nhận được kết quả gửi email."),
  };
  return `<div class="receipt-notice">
    <p>${messages[record.receipt.state]}</p>
    ${record.receipt.retryable ? `<button class="button button-soft" data-action="send-receipt" type="button">
      ${label("접수 안내 메일 보내기", "Gửi email xác nhận")}</button>` : ""}
  </div>`;
}

function confirmationPage(record) {
  return `<div class="wrap narrow page">
    ${pageHead(label("주거 상담을 접수했습니다", "Đã nhận yêu cầu tư vấn nhà ở"))}
    <div class="paper access-card receipt-panel">
      <dl class="key-value details-grid">
        <div><dt>${label("상담번호", "Mã hồ sơ")}</dt><dd>${escapeHtml(record.id)}</dd></div>
        <div><dt>${label("접수 일시", "Thời gian tiếp nhận")}</dt><dd>${displayDate(record.submittedAt, { year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</dd></div>
        ${record.contactEmail ? `<div class="receipt-email"><dt>${label("수신 이메일", "Email nhận thông báo")}</dt><dd>${escapeHtml(record.contactEmail)}</dd></div>` : ""}
      </dl>
      <p class="note-block">${label("담당자는 운영일 기준 2일 이내에 신청 내용을 확인할 예정입니다.",
        "Nhân viên dự kiến xem xét yêu cầu trong vòng 2 ngày làm việc của dịch vụ.")}</p>
      ${receiptNotice(record)}
      <a class="button" href="#/my-case">${label("내 상담 확인", "Xem hồ sơ của tôi")} ${nextArrow}</a>
    </div>
  </div>`;
}

function accessPage(cases = []) {
  if (window.dortoryVercel && !portalState.authenticated) return googleLoginCard(label("내 상담", "Hồ sơ của tôi"), "/#/my-case");
  return `<div class="wrap narrow page">
    ${pageHead(label("내 상담", "Hồ sơ của tôi"), "",
      `<button class="button button-soft" type="button" data-action="add-field-case" aria-haspopup="dialog">${label("현장 상담 추가", "Thêm hồ sơ tư vấn trực tiếp")}</button>`)}
    ${cases.length ? `<ul class="workspace-list">
      ${cases.map((record) => `<li class="workspace-row">
        <div class="workspace-row-title">
          <strong>${escapeHtml(record.id)} · ${escapeHtml(record.alias)}</strong>
          ${statusTag(stageLabel(record), stageStyle(record))}
        </div>
        <button class="button button-soft" data-action="open-own-case" data-id="${escapeHtml(record.id)}" type="button">${label("상담 열기", "Mở hồ sơ")}</button>
      </li>`).join("")}
    </ul>` : `<p>${label("이 계정에 연결된 상담이 없습니다.", "Tài khoản này chưa có hồ sơ.")} <a class="text-link" href="#/apply">${label("주거 상담 신청", "Đăng ký tư vấn")}</a></p>`}
  </div>`;
}

function fieldCaseEditor() {
  return `<form id="access-form">
    <div class="panel-heading"><h2 id="resource-title">${label("현장 상담 추가", "Thêm hồ sơ tư vấn trực tiếp")}</h2>
      <button class="close-button" type="button" data-action="close-resource" aria-label="${label("창 닫기", "Đóng hộp thoại")}">×</button>
    </div>
    <p>${label("담당자에게 받은 상담번호와 연결 코드를 입력해 주세요.", "Nhập mã hồ sơ và mã liên kết do nhân viên cung cấp.")}</p>
    ${field(label("상담번호", "Mã hồ sơ"), "caseCode", input("caseCode", "text", 'required maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false"'))}
    ${field(label("상담 연결 코드", "Mã liên kết"), "casePin", input("casePin", "text", 'required pattern="[A-Fa-f0-9]{16}" maxlength="16" autocomplete="off" autocapitalize="characters" spellcheck="false"'))}
    <p class="form-error" data-error role="alert"></p>
    <button class="button" type="submit">${label("내 상담에 추가", "Thêm vào hồ sơ của tôi")}</button>
  </form>`;
}

function stageLabel(record) {
  if (canEditCaseDocuments(record) && record.docs.requested.length) {
    return label("서류 보완", "Cần bổ sung hồ sơ");
  }
  return localize(STAGES[record.stage]);
}

function stageStyle(record) {
  if (record.stage === "waiting" || record.docs.requested.length) return "attention";
  if (record.stage === "complete" || record.stage === "submitted") return "done";
  return "working";
}

function statusTag(text, variant = "working") {
  return `<span class="status status-${variant}">${text}</span>`;
}

function workerOffer(record, offer, mayRequest, candidate) {
  const { home, route, monthly } = offer;
  const key = mapOptionKey(offer);
  return `<article class="paper worker-offer${candidate === key ? " is-map-selected" : ""}">
    <div class="offer-title">
      <div><h2>${escapeHtml(uiLanguage === "vi" ? home.nameVi || home.name : home.name)}</h2><p>${escapeHtml(home.address || localize(HOUSING_AREAS[home.area]))}</p></div>
      ${record.homeId === home.id ? statusTag(label("선택한 주택", "Nhà đã chọn"), "done") : ""}
    </div>
    <div class="offer-metrics">
      <p class="offer-cost">${money(monthly)} <span>${label("/ 월 예상", "/ tháng ước tính")}</span></p>
      ${Number.isInteger(route.rideHome) ? `<p>${label(`귀가편 출발 후 ${route.rideHome}분`, `${route.rideHome} phút sau khi xe về khởi hành`)}</p>` : ""}
    </div>
    <dl class="key-value details-grid">
      <div><dt>${label("보증금", "Tiền cọc")}</dt><dd>${money(home.deposit)}</dd></div>
      <div><dt>${label("입주 가능일", "Có thể vào ở từ")}</dt><dd>${displayDate(home.from)}</dd></div>
      <div><dt>${label("출근", "Đi làm")}</dt><dd>${escapeHtml(route.outbound)} → ${escapeHtml(route.arrival)}</dd></div>
      <div><dt>${label("귀가 출발", "Giờ về")}</dt><dd>${escapeHtml(route.inbound)}</dd></div>
    </dl>
    <details class="offer-breakdown"><summary>${label("월 비용 내역", "Chi tiết chi phí hằng tháng")}</summary>
      <dl class="key-value">
        <div><dt>${label("월세", "Tiền thuê")}</dt><dd>${money(home.rent)}</dd></div>
        <div><dt>${label("관리비·공과금", "Phí quản lý và điện nước")}</dt><dd>${money(home.bills)}</dd></div>
        <div><dt>${label("통근비", "Phí đi lại")}</dt><dd>${money(route.cost)}</dd></div>
      </dl>
    </details>
    ${mayRequest ? `<button class="button" type="button" data-action="request-visit" data-home="${escapeHtml(home.id)}" data-transit="${escapeHtml(route.id)}">${label("현장 방문 요청", "Đăng ký lịch hẹn")} ${nextArrow}</button>` : ""}
  </article>`;
}

function workerCasePage(record, data, candidate = "", tab = "") {
  const task = {
    received: label("담당자가 희망 조건과 근무시간을 확인하고 있어요.", "Nhân viên đang kiểm tra nhu cầu và ca làm của bạn."),
    waiting: label("담당자가 조건에 맞는 집과 왕복 통근편을 찾고 있어요.", "Nhân viên đang tìm nhà và phương án đi lại phù hợp."),
    offered: label("담당자가 주택과 통근편을 비교하고 있어요.", "Nhân viên đang so sánh nhà ở và phương án đi lại."),
    reviewing: label("담당자가 선택한 주택과 귀가편을 검토하고 있어요.", "Nhân viên đang kiểm tra nhà ở và phương án đi về đã chọn."),
    preparing: record.docs.requested.length
      ? label("보완 항목을 확인하고 준비한 서류를 담당자에게 전달해 주세요.", "Kiểm tra các mục và chuyển hồ sơ đã chuẩn bị cho nhân viên.")
      : label("담당자가 방문에 필요한 서류를 준비하고 있어요.", "Nhân viên đang chuẩn bị hồ sơ cho buổi hẹn."),
    visitReady: label("서류 준비를 마쳤어요. 현장 방문 일정을 요청할 수 있어요.", "Hồ sơ đã được chuẩn bị. Bạn có thể đăng ký lịch hẹn."),
    visit: label("담당자가 방문 일정과 계약 조건을 확인합니다.", "Nhân viên sẽ kiểm tra lịch xem nhà và điều kiện hợp đồng."),
    docs: record.docs.requested.length
      ? label("보완 항목을 확인하고 준비한 서류를 담당자에게 전달해 주세요.", "Kiểm tra các mục và chuyển hồ sơ đã chuẩn bị cho nhân viên.")
      : label("담당자가 입주 서류를 확인하고 있어요.", "Nhân viên đang kiểm tra hồ sơ vào ở."),
    submitted: label("서류 제출 결과가 기록됐어요. 담당자가 입주 여부를 확인합니다.", "Đã ghi nhận kết quả hồ sơ. Nhân viên sẽ xác nhận việc vào ở."),
    complete: label("입주 확인이 끝났어요.", "Đã xác nhận vào ở."),
  }[record.stage];
  const offers = record.offers.map((offer) => latestProposal(offer, data)).filter((offer) => offer
    && (!record.homeId || (offer.homeId === record.homeId && (!record.transitId || offer.transitId === record.transitId))));
  const followUp = caseCanUseAftercare(record);
  return `<div class="wrap narrow page worker-page">
    ${pageHead(label("내 상담", "Hồ sơ của tôi"), record.id,
      `<button class="button button-soft" data-action="sign-out-case" type="button">${label("상담 닫기", "Đóng hồ sơ")}</button>`)}
    ${followUp ? `<nav class="tab-nav" aria-label="${label("내 상담 메뉴", "Menu hồ sơ")}">
      ${navLink("/my-case", tab !== "aftercare", label("진행 상황", "Tiến độ"))}
      ${navLink("/my-case?tab=aftercare", tab === "aftercare", label("사후관리", "Hỗ trợ sau khi ghép nhà"))}</nav>` : ""}
    ${followUp && tab === "aftercare" ? aftercarePanel(record) : `
    <section class="case-message" aria-label="${label("다음 할 일", "Việc tiếp theo")}">
      ${statusTag(stageLabel(record), stageStyle(record))}
      <p>${task}</p>
      ${record.stage === "visit" && record.visitDate ? `<p class="subtle">${label("희망 일정", "Lịch mong muốn")} · ${formatVisit(record)}</p>` : ""}
    </section>
    ${canEditCaseDocuments(record) && record.docs.requested.length ? `<section class="paper worker-docs">
      <h2>${label("요청받은 서류", "Hồ sơ cần bổ sung")}</h2>
      <ul>${record.docs.requested.map((name) => `<li>${localize(DOC_ITEMS[name])}</li>`).join("")}</ul>
      ${record.docs.acknowledged ? `<p class="subtle">${label("보완 안내를 확인했습니다.", "Bạn đã xem hướng dẫn bổ sung.")}</p>`
        : `<button class="button button-soft" data-action="acknowledge-documents" type="button">${label("보완 안내 확인", "Đã xem hướng dẫn")}</button>`}
    </section>` : ""}
    ${offers.length ? `<div class="offer-stack">${offers.map((offer) => workerOffer(record, offer, record.stage === "visitReady", candidate)).join("")}</div>` : ""}
    ${record.contactEmail ? `<details class="paper receipt-details"><summary>${label("접수 안내 메일", "Email xác nhận tiếp nhận")}</summary>
      <p class="subtle">${escapeHtml(record.contactEmail)}</p>${receiptNotice(record)}</details>` : ""}
    `}
  </div>`;
}

function staffEntryPage() {
  if (window.dortoryVercel) {
    const denied = adminState.authenticated && !adminState.allowed;
    return googleLoginCard("관리자 로그인", "/" + (location.hash || "#/staff"), {
      description: denied ? "현재 구글 계정에는 관리자 권한이 없습니다. 지정된 관리자 계정을 선택해 주세요."
        : "지정된 관리자 구글 계정으로 로그인하면 업무함이 열립니다.",
      action: denied ? "다른 구글 계정으로 로그인" : "구글 계정으로 로그인",
    });
  }
  if (!adminState.allowed) return `<div class="wrap narrow page">${pageHead("관리자 로그인", "지정된 관리자 계정으로 이 사이트를 열어 주세요.")}</div>`;
  return `<div class="wrap narrow page admin-login">
    ${pageHead("관리자 업무함")}
    <form id="admin-login-form" class="admin-login-form">
      <p class="form-error" id="admin-login-feedback" role="alert"></p>
      <button class="button" type="submit">업무함 열기</button>
    </form>
  </div>`;
}

const STAFF_FILTERS = {
  all: { title: "전체", show: () => true },
  received: { title: "신규 접수", show: (record) => record.stage === "received" },
  waiting: { title: "매칭 대기", show: (record) => record.stage === "waiting" },
  documents: { title: "서류 보완", show: (record) => canEditCaseDocuments(record) && record.docs.requested.length > 0 },
  aftercare: { title: "사후관리", show: (record) => openAftercareCount(record) > 0 },
  due: { title: "기한 임박", show: (record) => {
    const horizon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return Boolean(record.due && record.due <= horizon && record.stage !== "complete");
  } },
};

function nextStep(record) {
  if (openAftercareCount(record)) return `처리할 사후관리 요청 ${openAftercareCount(record)}건`;
  if (record.docs.requested.length) return "요청한 자료 제출 확인";
  if (canEditCaseDocuments(record) && record.docs.supplied.length) return "회신 자료 검토";
  return STAGES[record.stage].next;
}

function formatVisit(record) {
  return `${displayDate(record.visitDate, { weekday: "short", year: "numeric" })} · ${localize(VISIT_SLOTS[record.visitTime])}`;
}

function staffDashboard(data, filter, area = "", intakeOpen = false) {
  const chosen = STAFF_FILTERS[filter] || STAFF_FILTERS.all;
  const records = staffCaseRows(data, filter, area);
  const demo = data.cases.find((record) => record.channel === "demo");
  return `<div class="wrap page">
    ${pageHead("업무함", `${area ? localize(WORK_AREAS[area]) : "서천군 전체"} · 상담 ${records.length}건`,
      '<button class="button button-soft" data-action="workspace-latest" type="button">새로고침</button>')}
    ${ragSearchPanel()}
    <nav class="filter-list" aria-label="상담 상태 필터">
      ${Object.entries(STAFF_FILTERS).map(([key, item]) => `<a href="#${escapeHtml(dashboardRoute("/staff", { area, filter: key }))}"${chosen === item ? ' aria-current="page"' : ""}>${item.title} <span>${staffCaseRows(data, key, area).length}</span></a>`).join("")}
    </nav>
    <section class="staff-case-list" aria-labelledby="case-list-title">
    <div class="panel-heading">
      <h2 id="case-list-title">상담 내역</h2>
      <div class="actions">
        ${demo ? `<a class="text-link" href="#/staff/cases/${escapeHtml(demo.id)}/${currentCaseStep(demo)}">최근 시연 열기</a>` : ""}
        <button class="button button-soft" type="button" data-action="start-matching-demo">매칭 시연 시작</button>
      </div>
    </div>
    <details class="paper field-intake-disclosure"${intakeOpen ? " open" : ""}>
      <summary>현장 상담 등록</summary>
      <div class="field-intake-body">${applicationForm(true, area)}</div>
    </details>
    ${records.length ? `<ul class="workspace-list">
      ${records.map((record) => `<li><a class="workspace-row" href="#/staff/cases/${escapeHtml(record.id)}/${currentCaseStep(record)}">
        <div class="workspace-row-title"><strong>${escapeHtml(record.id)} · ${escapeHtml(record.alias)}</strong>${statusTag(stageLabel(record), stageStyle(record))}</div>
        <span>${localize(WORK_AREAS[record.area])} · ${nextStep(record)}</span>
        <span class="subtle">${escapeHtml(record.assigned)}${record.due ? ` · 기한 ${displayDate(record.due)}` : ""}</span>
      </a></li>`).join("")}
    </ul>` : `<p class="empty">${staffCaseRows(data, "all").length ? "조건에 맞는 상담이 없습니다." : "접수된 상담이 없습니다."}</p>`}
    </section>
  </div>`;
}

const MATCH_REASONS = {
  public: "현장 확인", home: "임대 동의·주거 용도", dates: "거주 기간", space: "거주 인원",
  reserved: "동일 기간 배정", budget: "월 예산 초과", cost: "비용 미확인", route: "왕복편 미확인",
  return: "귀가편 미확인", verify: "왕복 운행 확인", shift: "교대시간 불일치", seats: "통근 좌석",
  link: "주택과 정류장 연결",
};

function staffCandidate(option, record, recommendation) {
  const { home, route, monthly, reasons, eligible } = option;
  const selected = record.homeId === home.id && record.transitId === route?.id;
  return `<li class="housing-row">
    <div class="housing-identity">
      <strong>${escapeHtml(home.name)}</strong>
      <span>${escapeHtml(home.address || localize(HOUSING_AREAS[home.area]))}</span>
      ${reasons.length ? `<span class="subtle">확인할 항목 · ${reasons.map((key) => MATCH_REASONS[key]).join(", ")}</span>` : ""}
    </div>
    <div class="housing-terms">
      <span>${monthly === null ? "비용 확인 필요" : `${money(monthly)} ${route ? "/ 월 예상" : "/ 월 주거비"}`}</span>
      ${record.channel === "demo" && route ? `<span class="subtle">${escapeHtml(route.name)} · 출근 도착 ${escapeHtml(route.arrival)}</span>` : ""}
      <span class="subtle">${route?.inbound ? "귀가 " + escapeHtml(route.inbound) : "귀가편 확인 필요"}</span>
    </div>
    <div class="housing-actions">
      ${selected ? statusTag("선택한 조합", "done") : recommendation ? statusTag("우선 검토", "working") : ""}
      ${eligible && canChooseHousing(record) && !selected ? `<button class="button" type="button" data-action="select-housing" data-home="${escapeHtml(home.id)}" data-transit="${escapeHtml(route.id)}" aria-label="${escapeHtml(home.name)} 조합 선택">이 조합 선택</button>`
        : !eligible && canChooseHousing(record) ? registryEditButton(home, "조건 확인") : ""}
    </div>
  </li>`;
}

function caseInfo(record) {
  const demo = record.channel === "demo";
  return `<section class="paper case-panel">
    <h2>접수 내용</h2>
    <dl class="key-value details-grid info-grid">
      <div><dt>이용자 별칭</dt><dd>${escapeHtml(record.alias)}</dd></div>
      <div><dt>접수 방식</dt><dd>${demo ? "매칭 시연" : record.channel === "field" ? "현장 상담" : "모바일 신청"}</dd></div>
      <div><dt>선호 언어</dt><dd>${record.locale === "vi" ? "Tiếng Việt" : "한국어"}</dd></div>
      ${demo ? "" : `<div><dt>${record.contactEmail ? "접수 이메일" : "연락 방법"}</dt><dd>${record.contactEmail
        ? escapeHtml(record.contactEmail) : record.contact === "onsite" ? "현장 상담" : "문자 안내"}</dd></div>`}
      <div><dt>거주 인원</dt><dd>${record.people}명</dd></div>
      <div><dt>거주 종료 예정</dt><dd>${displayDate(record.moveOut, { year: "numeric" })}</dd></div>
    </dl>
    ${record.notes ? `<p class="note-block"><strong>상담 메모</strong><br>${escapeHtml(record.notes)}</p>` : ""}
    ${record.channel === "field" && !record.accountId ? `<div class="note-block">
      <strong>이용자 계정 연결</strong>
      ${/^[A-F0-9]{16}$/.test(record.pin ?? "") ? `<p>상담번호 ${escapeHtml(record.id)} · 연결 코드 <code>${escapeHtml(record.pin)}</code></p>`
        : '<p>이용자에게 전달할 상담 연결 코드를 발급하세요.</p>'}
      <button class="button button-soft" data-action="issue-access-code" type="button">${/^[A-F0-9]{16}$/.test(record.pin ?? "") ? "코드 재발급" : "연결 코드 발급"}</button>
    </div>` : ""}
    ${record.stage === "received" ? '<div class="actions case-step-action"><button class="button" data-action="confirm-intake" type="button">상담 정보 확인 후 비교</button></div>' : ""}
  </section>`;
}

function caseCompare(record, data) {
  const demo = record.channel === "demo";
  const match = rankHousing(record, candidateOptions(record, data));
  const ready = [...match.confirmed];
  const selected = eligiblePlacement(record, data);
  if (selected) {
    const i = ready.findIndex((option) => option.home.id === selected.home.id);
    if (i >= 0) ready.splice(i, 1);
    ready.unshift(selected);
  }
  const registeredPending = match.pending;
  const inquiry = match.inventory.filter((home) => home.source?.type !== "매매");
  const sale = match.inventory.filter((home) => home.source?.type === "매매");
  const first = inquiry.slice(0, 6);
  return `<section class="paper case-panel comparison-panel">
    <h2>주택·통근 비교</h2>
    ${demo ? '<p class="subtle">월 비용과 운행 시각은 시연용입니다. 조합을 선택하면 AI 도토리에서 검토할 수 있습니다.</p>'
      : canChooseHousing(record) ? '<p class="subtle">조건을 확인한 조합을 선택하면 AI 도토리에서 검토할 수 있습니다.</p>' : ""}
    ${record.waitReason ? `<p class="note-block">확인할 항목 · ${MATCH_REASONS[record.waitReason] ?? "상담 조건"}</p>` : ""}
    <section class="housing-section">
      <h3>선택 가능 <span>${ready.length}곳</span></h3>
      ${ready.length ? `<ul class="housing-rows">${ready.map((item, pos) => staffCandidate(item, record, pos === 0)).join("")}</ul>`
        : `<p class="subtle">임대 조건과 왕복편을 확인하면 이곳에서 선택할 수 있습니다.</p>
          ${!demo && canChooseHousing(record) ? '<button class="button button-soft" type="button" data-action="start-matching-demo">시연 조합 3건 비교하기</button>' : ""}`}
    </section>
    ${demo ? "" : `<section class="housing-section">
      <h3>확인할 주택 <span>${registeredPending.length + inquiry.length}곳</span></h3>
      <ul class="housing-rows">${registeredPending.map((item) => staffCandidate(item, record, false)).join("")}${first.map(housingRow).join("")}</ul>
      ${inquiry.length > first.length ? `<details class="registry-more"><summary>다른 주택 ${inquiry.length - first.length}곳</summary>
        <ul class="housing-rows">${inquiry.slice(first.length).map(housingRow).join("")}</ul></details>` : ""}
      ${sale.length ? `<details class="registry-more"><summary>그린대로 매매 자료 ${sale.length}건</summary>
        <ul class="housing-rows">${sale.map(housingRow).join("")}</ul></details>` : ""}
    </section>`}
  </section>`;
}

function caseDocs(record, data) {
  const title = "<h2>입주 서류</h2>";
  if (!canEditCaseDocuments(record)) return `<section class="paper case-panel">${title}${officialPanel(record)}
    ${record.docs.result ? `<p class="note-block">기록된 결과 · ${escapeHtml(record.docs.result)}</p>` : ""}</section>`;
  const preparing = record.stage === "preparing";
  const placement = selectedProposal(record, data);
  const { draft, supplied, requested, checked } = record.docs;
  return `<section class="paper case-panel">
    ${title}
    ${preparing ? '<p class="subtle">공식 양식과 검토 초안을 준비합니다. 방문 후 계약과 실제 제출 결과를 기록할 수 있습니다.</p>' : ""}
    ${officialPanel(record)}
    <div class="document-columns">
      <form id="draft-form" class="document-draft">
        <h3>담당자 검토 기록</h3>
        ${field("새 체류지 주소", "housingText", input("housingText", "text", 'required maxlength="200"', draft?.housingText ?? placement?.home.address))}
        ${field(preparing ? "입주 예정일" : "확인한 전입일", "plannedDate", input("plannedDate", "date", "required", draft?.plannedDate ?? (preparing ? record.moveIn : "")))}
        ${field("계약 또는 제공 조건", "terms", input("terms", "text", 'required maxlength="300"', draft?.terms))}
        <p class="form-error" data-error role="alert"></p>
        <button class="button button-soft" type="submit">초안 저장</button>
      </form>
    </div>
    <form id="checklist-form" class="checklist">
      <fieldset><legend>서류 체크리스트</legend>
        ${Object.entries(DOC_ITEMS).map(([key, names]) => `<label class="checkbox-line"><input type="checkbox" name="documents" value="${key}"${checked.includes(key) ? " checked" : ""}>
          <span>${names.ko}</span>
          ${requested.includes(key) ? statusTag("보완 요청 중", "attention") : supplied.includes(key) ? statusTag("자료 도착", "working") : ""}
        </label>`).join("")}
      </fieldset>
      <p class="form-error" data-error role="alert"></p>
      <div class="actions">
        <button class="button button-soft" type="submit" value="save">확인 항목 저장</button>
        <button class="button button-soft" type="submit" value="request">미확인 서류 보완 요청</button>
        ${preparing ? '<button class="button" type="submit" value="prepare">서류 준비 확인 후 방문 접수</button>' : ""}
      </div>
    </form>
    <p class="subtle">신청인 또는 권한 있는 담당자가 원본과 대조한 뒤 관할 기관에 제출합니다. 실제 접수 결과를 확인한 뒤 기록합니다.</p>
  </section>`;
}

function visitSlotOptions() {
  return Object.fromEntries(Object.entries(VISIT_SLOTS).map(([key, descriptions]) => [key, localize(descriptions)]));
}

function caseVisit(record, data) {
  const placement = selectedProposal(record, data);
  const base = `#/staff/cases/${escapeHtml(record.id)}`;
  let action = "";
  if (record.stage === "visitReady") {
    action = `<form id="staff-visit-form" class="case-visit-form">
      <div class="form-grid">
        ${field("방문 날짜", "staffVisitDate", input("staffVisitDate", "date", "required"))}
        ${field("시간대", "staffVisitSlot", select("staffVisitSlot", { "": "선택", ...visitSlotOptions() }, "", "required"))}
      </div>
      <p class="form-error" data-error role="alert"></p>
      <button class="button" type="submit">방문 일정 접수</button>
    </form>`;
  } else if (record.stage === "visit") {
    action = '<div class="actions case-step-action"><button class="button" data-action="confirm-contract" type="button">방문·계약 확인</button></div>';
  } else if (record.stage === "docs") {
    const ready = record.docs.draft && Object.keys(DOC_ITEMS).every((key) => record.docs.checked.includes(key));
    action = ready ? `<form id="visit-result-form" class="case-visit-form">
      ${field("실제 제출 결과", "visitOutcome", input("visitOutcome", "text", 'required maxlength="200" placeholder="예: 관할 기관 접수 확인"'))}
      <p class="form-error" data-error role="alert"></p>
      <button class="button" type="submit">제출 결과 기록</button>
    </form>` : `<div class="case-step-action">
      <p>제출 결과를 기록하려면 입주 서류 초안과 체크리스트를 확인해 주세요.</p>
      <a class="text-link" href="${base}/docs">입주 서류 확인</a>
    </div>`;
  } else if (record.stage === "submitted") {
    action = '<div class="actions case-step-action"><button class="button" data-action="confirm-move" type="button">입주 확인</button></div>';
  }
  return `<section class="paper case-panel">
    <h2>현장 방문 접수</h2>
    ${placement ? `<p class="case-visit-location"><strong>${escapeHtml(placement.home.name)}</strong> · ${escapeHtml(placement.home.address)}</p>` : ""}
    ${record.visitDate ? `<p class="note-block"><strong>방문 일정</strong> · ${formatVisit(record)}</p>`
      : record.stage === "visitReady" ? '<p class="subtle">이용자와 확인한 날짜와 시간대를 등록하세요.</p>' : ""}
    ${record.docs.result ? `<p class="note-block"><strong>제출 결과</strong> · ${escapeHtml(record.docs.result)}</p>` : ""}
    ${action}
  </section>`;
}

const HISTORY_LABELS = {
  created: "상담 접수", intakeConfirmed: "상담 정보 확인", offered: "주거·통근 제안 발송", waiting: "조건 확인 필요 항목 기록",
  housingSelected: "주택·통근 조합 선택", aiReviewed: "AI 도토리 검토 확인", docsPrepared: "입주 서류 준비 확인",
  visit: "현장 방문 접수", contract: "방문·계약 확인", draft: "예시 서류 초안 생성",
  draftSaved: "제출용 초안 저장", checked: "서류 확인 항목 저장", requested: "서류 보완 요청",
  supplied: "자료 전달", acknowledged: "이용자가 보완 안내 확인", submitted: "제출 결과 기록", complete: "입주 확인",
  aftercare: "사후관리 요청 접수", aftercareUpdated: "사후관리 처리 상태 기록",
};

function caseHistory(record) {
  return `<section class="paper case-panel"><h2>처리 이력</h2>
    <ol class="history-list">${[...record.history].reverse().map((event) => `<li>
      <strong>${HISTORY_LABELS[event.kind]}</strong>
      <time datetime="${escapeHtml(event.at)}">${displayDate(event.at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</time>
      ${event.detail ? `<span>${escapeHtml(event.detail)}</span>` : ""}
    </li>`).join("")}</ol>
  </section>`;
}

function caseProgressNav(record, tab, base) {
  const step = currentCaseStep(record);
  return `<nav aria-label="상담 처리 순서">
    <ol class="case-progress">
      ${Object.entries(CASE_STEPS).map(([key, title]) => {
        const unlocked = caseStepUnlocked(record, key);
        const state = !unlocked ? "locked" : key === step && record.stage !== "complete" ? "current" : "done";
        const current = tab === key ? ' aria-current="step"' : "";
        return `<li class="step-${state}">${unlocked ? `<a href="${base}/${key}"${current}>${title}</a>`
          : `<span aria-disabled="true" aria-label="${title} · 앞 단계 완료 후 열림">${title}</span>`}</li>`;
      }).join("")}
    </ol>
  </nav>`;
}

function staffCase(record, data, tab, inboxRoute = "/staff") {
  const base = `#/staff/cases/${escapeHtml(record.id)}`;
  const activeStep = currentCaseStep(record);
  const wasEarlierStep = Object.hasOwn(CASE_STEPS, tab) && tab !== activeStep;
  return `<div class="wrap page">
    <a class="back-link" href="#${escapeHtml(inboxRoute)}">← 업무함</a>
    ${pageHead(record.channel === "demo" ? "매칭 시연" : record.id,
      `${escapeHtml(record.channel === "demo" ? record.alias : record.assigned)} · ${nextStep(record)}`,
      statusTag(stageLabel(record), stageStyle(record)))}
    <dl class="case-summary key-value">
      <div><dt>입주 희망일</dt><dd>${displayDate(record.moveIn, { year: "numeric" })}</dd></div>
      <div><dt>월 예산</dt><dd>${money(record.budget)}</dd></div>
      <div><dt>근무지</dt><dd>${localize(WORK_AREAS[record.area])}</dd></div>
      <div><dt>근무시간</dt><dd>${escapeHtml(record.workFrom)}–${escapeHtml(record.workTo)}</dd></div>
    </dl>
    ${caseProgressNav(record, tab, base)}
    <nav class="case-reference" aria-label="상담 기록">
      <a class="text-link" href="${base}/history"${tab === "history" ? ' aria-current="page"' : ""}>처리 이력</a>
      ${caseCanUseAftercare(record) ? `<a class="text-link" href="${base}/aftercare"${tab === "aftercare" ? ' aria-current="page"' : ""}>사후관리</a>` : ""}
    </nav>
    ${tab === "compare" ? caseCompare(record, data) : tab === "ai" ? caseAssistant(record, data)
      : tab === "docs" ? caseDocs(record, data) : tab === "visit" ? caseVisit(record, data)
        : tab === "aftercare" ? aftercarePanel(record, true) : tab === "history" ? caseHistory(record) : caseInfo(record)}
    ${wasEarlierStep ? `<div class="actions case-step-action"><a class="button button-soft" href="${base}/${activeStep}">현재 단계 · ${CASE_STEPS[activeStep]}</a></div>` : ""}
  </div>`;
}

function registryEditButton(home, caption = home.origin === "public" ? "조건 확인" : "편집") {
  return `<button class="button button-soft" type="button" data-action="resource" data-type="homes"
    data-id="${escapeHtml(home.id)}" aria-label="${escapeHtml(home.name + " " + caption)}">${caption}</button>`;
}

function housingRow(item) {
  const source = item.source;
  const readiness = item.ready ? "임대 조건 확인" : item.origin === "public"
    ? source?.type === "매매" ? "매매 공고" : "임대 확인 필요" : "현장 확인 중";
  return `<li class="housing-row">
    <div class="housing-identity">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.address || localize(HOUSING_AREAS[item.area]))}</span>
      ${source?.phone ? `<a class="text-link" href="tel:${escapeHtml(source.phone)}">관리사무소 ${escapeHtml(source.phone)}</a>` : ""}
    </div>
    <div class="housing-terms">
      ${statusTag(readiness, item.ready ? "done" : "working")}
      ${item.ready ? `<span class="subtle">월세 ${money(item.rent)} · ${displayDate(item.from)}부터</span>` : ""}
      ${source ? `<span class="subtle"><a class="text-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.type)} 원천</a> ${escapeHtml(source.date)}</span>` : ""}
      ${source?.notice ? `<a class="text-link subtle" href="${escapeHtml(source.notice.url)}" target="_blank" rel="noopener">LH 국민임대 · 접수 마감</a>` : ""}
    </div>
    <div class="housing-actions">${registryEditButton(item)}</div>
  </li>`;
}

function staffResources(data, type, area = "", params = new URLSearchParams()) {
  const homes = type === "homes";
  const q = (params.get("q") || "").trim();
  const status = params.get("status") || "all";
  const statuses = { all: "전체", ready: "확인 완료", review: "조건 확인", ...(homes ? { sale: "매매 공고" } : {}) };
  const matchState = (item) => status === "all" || (status === "sale" ? item.source?.type === "매매"
    : status === "ready" ? item.ready : !item.ready && item.source?.type !== "매매");
  const items = data[type].filter((item) => (!area || (homes ? homeResourceGroup(item) : item.work) === area)
    && matchState(item) && (!q || [item.name, item.address].some((text) => text?.toLowerCase().includes(q.toLowerCase()))));
  const available = registryAvailability;
  return `<div class="wrap page registry-page">
    ${pageHead(homes ? "주택 대장" : "통근 대장", "",
      `<button class="button" data-action="resource" data-type="${type}" type="button">${homes ? "주택 등록" : "통근편 등록"}</button>`)}
    <nav class="tab-nav" aria-label="대장 분류">
      ${navLink("/staff/resources/homes", homes, "주택")}
      ${navLink("/staff/resources/transits", !homes, "통근편")}
    </nav>
    <form id="registry-filter" class="registry-filter">
      ${field("이름·주소 검색", "q", input("q", "search", 'maxlength="100"', q))}
      ${field(homes ? "읍·면" : "근무지", "area", select("area", { "": "전체", ...areaOptions(homes ? HOME_GROUPS : WORK_AREAS) }, area))}
      ${field("상태", "status", select("status", statuses, status))}
      <button class="button button-soft" type="submit">찾기</button>
    </form>
    ${homes && available ? `<div class="registry-meta">
      <p class="subtle">서천군 아파트 ${available.apartments}곳 · 그린대로 ${available.green}건 · ${available.greenMode === "current" ? "원천 조회" : "기준 자료"} ${escapeHtml(available.greenDate.slice(0, 10))}</p>
      <button class="text-button" type="button" data-action="refresh-catalog">공개 자료 다시 조회</button>
    </div>` : ""}
    ${!homes ? '<p class="subtle">주택과 실제 승차 위치·왕복 시각을 확인한 운행편을 연결하세요. <a class="text-link" href="https://www.data.go.kr/data/15108124/openapi.do" target="_blank" rel="noopener">서천군 교통정보</a></p>' : ""}
    <p class="subtle">검색 결과 ${items.length}건</p>
    ${items.length ? `<ul class="housing-rows registry-results">${homes ? items.map(housingRow).join("") : items.map((item) => `<li class="housing-row">
      <div class="housing-identity"><strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(data.homes.find((home) => home.id === item.homeId)?.name || "연결 주택 확인 필요")}</span></div>
      <div class="housing-terms">${statusTag(item.ready ? "운행 확인" : "확인 중", item.ready ? "done" : "attention")}
        <span class="subtle">출근 도착 ${escapeHtml(item.arrival || "확인 필요")} · 귀가 출발 ${escapeHtml(item.inbound || "확인 필요")}</span></div>
      <div class="housing-actions"><button class="button button-soft" type="button" data-action="resource" data-type="transits" data-id="${escapeHtml(item.id)}">편집</button></div>
    </li>`).join("")}</ul>` : '<p class="empty">조건에 맞는 기록이 없습니다.</p>'}
  </div>`;
}

function resourceEditor(type, item = {}) {
  const home = type === "homes";
  const inquiry = item.origin === "public";
  const numeric = 'inputmode="numeric" min="0" max="1000000000"';
  const managed = database.homes.filter((entry) => entry.origin === "registered" || entry.id === item.homeId);
  const linked = { "": "선택", ...Object.fromEntries(managed.map((entry) => [entry.id, entry.name])) };
  return `<form id="resource-form" data-type="${type}" data-id="${escapeHtml(item.id)}">
    <div class="panel-heading"><h2 id="resource-title">${home ? "주택" : "통근편"} ${inquiry ? "조건 확인" : item.id ? "편집" : "등록"}</h2>
      <button class="close-button" type="button" data-action="close-resource" aria-label="창 닫기">×</button>
    </div>
    ${inquiry ? `<p class="subtle">${escapeHtml(item.address)} · <a class="text-link" href="${escapeHtml(item.source?.url)}" target="_blank" rel="noopener">공개 원천</a></p>` : ""}
    <div class="form-grid">
      ${field("표시 이름", "resourceName", input("resourceName", "text", 'required maxlength="120"', item.name), true)}
      ${home ? [
        field("주택 권역", "resourceArea", select("resourceArea", areaOptions(HOUSING_AREAS), item.area || "market"), true),
        field("정확한 주택 주소", "resourceAddress", input("resourceAddress", "text", 'maxlength="180"', item.address?.includes("*") ? "" : item.address), true),
        field("입주 가능일", "resourceFrom", input("resourceFrom", "date", "", item.from)),
        field("계약 가능 종료일", "resourceUntil", input("resourceUntil", "date", "", item.until)),
        field("거주 가능 인원", "resourcePlaces", input("resourcePlaces", "number", 'min="1" max="30" inputmode="numeric"', item.places ?? "")),
        field("보증금(원)", "resourceDeposit", input("resourceDeposit", "number", numeric, item.deposit ?? "")),
        field("월세(원)", "resourceRent", input("resourceRent", "number", numeric, item.rent ?? "")),
        field("관리비·공과금(원)", "resourceBills", input("resourceBills", "number", numeric, item.bills ?? "")),
      ].join("") : [
        field("연결 주택", "resourceHomeId", select("resourceHomeId", linked, item.homeId || ""), true),
        field("도착 근무지", "resourceWork", select("resourceWork", areaOptions(WORK_AREAS), item.work || "janghang")),
        field("통근 수단", "resourceMode", select("resourceMode", { shuttle: "사업장 차량", bus: "버스", walk: "도보", other: "기타" }, item.mode || "shuttle")),
        field("출근 출발 시각", "resourceOutbound", input("resourceOutbound", "time", "", item.outbound)),
        field("출근 도착 시각", "resourceArrival", input("resourceArrival", "time", "", item.arrival)),
        field("귀가 출발 시각", "resourceInbound", input("resourceInbound", "time", "", item.inbound)),
        field("승차 지점까지 도보(분)", "resourceWalk", input("resourceWalk", "number", 'inputmode="numeric" min="0" max="180"', item.walk ?? "")),
        field("귀가편 출발 후 집까지(분)", "resourceRideHome", input("resourceRideHome", "number", 'min="0" max="400"', item.rideHome ?? "")),
        field("귀가편 환승 횟수", "resourceTransfers", input("resourceTransfers", "number", 'min="0" max="20"', item.transfers ?? "")),
        field("이용 가능 좌석", "resourceSeats", input("resourceSeats", "number", 'inputmode="numeric" min="0" max="200"', item.seats ?? "")),
        field("월 통근비(원)", "resourceCost", input("resourceCost", "number", numeric, item.cost ?? "")),
        field("운행 확인 근거", "resourceOwner", input("resourceOwner", "text", 'maxlength="180" placeholder="예: 운행 담당 부서 또는 확인한 정류장·시간표"', item.owner), true),
      ].join("")}
    </div>
    <label class="checkbox-line"><input type="checkbox" name="resourceReady"${item.ready ? " checked" : ""}><span>${home ? "소유자 임대 동의·주거 용도·안전 확인 완료" : "연결 주택에서 이용 가능한 왕복 운행 확인 완료"}</span></label>
    <p class="form-error" data-error role="alert"></p>
    <button class="button" type="submit">저장</button>
  </form>`;
}

function visitEditor(home, route) {
  return `<form id="visit-form" data-home="${home.id}" data-transit="${route.id}">
    <div class="panel-heading"><h2 id="resource-title">${label("방문 요청", "Yêu cầu xem nhà")}</h2>
      <button class="close-button" type="button" data-action="close-resource" aria-label="${label("창 닫기", "Đóng hộp thoại")}">×</button>
    </div>
    <p>${escapeHtml(uiLanguage === "vi" ? home.nameVi || home.name : home.name)}</p>
    ${field(label("희망 방문일", "Ngày muốn xem nhà"), "visitDate", input("visitDate", "date", "required"))}
    ${field(label("희망 시간대", "Thời gian mong muốn"), "visitTime", select("visitTime", visitSlotOptions(), "evening"))}
    <p class="form-error" data-error role="alert"></p>
    <button class="button" type="submit">${label("방문 요청 보내기", "Gửi yêu cầu xem nhà")}</button>
  </form>`;
}

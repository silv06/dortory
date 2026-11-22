const OFFICIAL_FORMS = {
  county: {
    title: "체류지 변경신고서 · 군청·읍면", file: "change-address-vi", no: "별지 제34호의6 · 한·베 병기",
    source: "https://www.law.go.kr/LSW/flDownload.do?flSeq=170813579",
    fields: ["fullName", "nationality", "sex", "arc", "phone", "address", "countyResidence", "countyOther", "moveOn", "signDate"],
    required: ["fullName", "nationality", "sex", "arc", "address", "countyResidence", "moveOn", "signDate"],
    guide: ["신고서는 한글 또는 영문으로 작성하고, 실제 전입일을 기준으로 신고 기한을 확인하세요.", "Điền bằng tiếng Hàn hoặc tiếng Anh. Kiểm tra thời hạn theo ngày thực tế chuyển đến."],
  },
  immigration: {
    title: "통합신청서 · 출입국관서", file: "integrated-application", no: "별지 제34호 · 체류지 변경신고",
    source: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    fields: ["lastName", "givenName", "birth", "sex", "nationality", "arc", "passport", "address", "phone", "moveOn", "signDate"],
    required: ["lastName", "givenName", "birth", "sex", "nationality", "arc", "address", "moveOn", "signDate"],
    guide: ["신고 종류는 체류지 변경신고로 표시합니다. 성과 이름은 등록증·여권 표기와 대조하세요.", "Biểu mẫu chọn mục thay đổi nơi lưu trú. Đối chiếu họ tên với thẻ cư trú hoặc hộ chiếu."],
  },
  stay: {
    title: "거주·숙소제공 확인서", file: "accommodation", no: "하이코리아 · 2024년 5월 개정",
    source: "https://www.hikorea.go.kr/board/BoardApplicationListR.pt",
    fields: ["fullName", "nationality", "arc", "phone", "address", "provider", "providerNationality", "providerArc", "providerPhone",
      "relationship", "relationshipOther", "ownership", "ownershipOther", "stayType", "stayOther", "providedOn", "providedSigned", "company"],
    required: ["fullName", "nationality", "arc", "address", "provider", "providerNationality", "providerArc", "relationship", "ownership", "stayType", "providedOn", "providedSigned"],
    guide: ["제공 시작일과 확인서 작성일을 각각 확인하세요. 제공자의 신분증 사본과 숙소 소유·임차 증빙은 서식 하단 기준에 따라 준비하세요.", "Kiểm tra riêng ngày bắt đầu cung cấp chỗ ở và ngày lập giấy. Chuẩn bị bản sao giấy tờ của người cung cấp và chứng từ theo hướng dẫn trên mẫu."],
  },
  lease: {
    title: "주택임대차 표준계약서", file: "lease-ko", no: "법무부 · 2023년 10월 6일 게시본",
    source: "https://www.moj.go.kr/bbs/moj/118/575868/artclView.do",
    translation: "https://www.moj.go.kr/bbs/moj/118/604192/artclView.do",
    fields: ["address", "unit", "building", "areaM2", "leaseType", "contractType", "leaseFrom", "leaseUntil",
      "deposit", "firstPayment", "interimPayment", "interimDate", "lastPayment", "lastDate", "rent", "rentDay", "bills",
      "lessor", "lessorAddress", "lessorArc", "lessorPhone", "fullName", "tenantAddress", "arc", "phone", "contractSigned", "leaseExtras"],
    required: ["address", "unit", "leaseType", "contractType", "leaseFrom", "leaseUntil", "deposit", "rent", "bills",
      "lessor", "lessorAddress", "fullName", "tenantAddress", "contractSigned"],
    guide: ["당사자 합의에 따라 수리·특약·중개 사항과 임대인·임차인 서명 또는 날인을 완료하세요. 정액 관리비가 월 10만 원 이상이면 원본에서 세부 금액을 확인하세요.",
      "Hai bên hoàn tất các điều khoản về sửa chữa, thỏa thuận riêng, môi giới và ký tên hoặc đóng dấu. Kiểm tra chi tiết phí quản lý từ 100.000 won/tháng."],
  },
};

const OFFICIAL_FIELDS = {
  fullName: ["성명", "Họ và tên"],
  lastName: ["성", "Họ"], givenName: ["이름", "Tên"], nationality: ["국적", "Quốc tịch"],
  birth: ["생년월일", "Ngày sinh", "date"], sex: ["성별", "Giới tính", { male: "남 / Nam", female: "여 / Nữ" }],
  arc: ["외국인등록번호", "Số thẻ cư trú", "id"], passport: ["여권번호", "Số hộ chiếu"],
  phone: ["전화번호", "Số điện thoại", "tel"], address: ["새 체류지 주소", "Địa chỉ mới", "wide"],
  countyResidence: ["거주 형태", "Hình thức cư trú", { own: "자가", lease: "전·월세", other: "그 밖의 형태" }],
  countyOther: ["그 밖의 거주 형태 상세", "Hình thức cư trú khác"],
  moveOn: ["실제 전입일 · 기한 확인용", "Ngày thực tế chuyển đến", "date"], signDate: ["신고일", "Ngày khai báo", "date"],
  provider: ["숙소 제공자 성명", "Tên người cung cấp"], providerNationality: ["제공자 국적", "Quốc tịch người cung cấp"],
  providerArc: ["제공자 주민·외국인등록번호", "Số đăng ký của người cung cấp", "id"],
  providerPhone: ["제공자 전화", "Điện thoại người cung cấp", "tel"],
  relationship: ["근로자와의 관계", "Mối quan hệ", { family: "가족·친척", employer: "고용주", other: "기타" }],
  relationshipOther: ["기타 관계 상세", "Chi tiết quan hệ khác"],
  ownership: ["제공자의 소유형태", "Hình thức sở hữu", { own: "자가", rent: "임대", other: "기타" }],
  ownershipOther: ["기타 소유형태 상세", "Chi tiết sở hữu khác"],
  stayType: ["주거 형태", "Loại chỗ ở", { private: "개인주택 등", dorm: "기숙사", lodging: "숙박시설", other: "기타" }],
  stayOther: ["기타 주거 형태 상세", "Chi tiết chỗ ở khác"],
  providedOn: ["실제 숙소 제공 시작일", "Ngày bắt đầu cung cấp chỗ ở", "date"],
  providedSigned: ["확인서 작성일", "Ngày lập giấy xác nhận", "date"], company: ["업체명", "Tên doanh nghiệp"],
  unit: ["임차 부분 · 동·층·호 또는 건물 전체", "Phần thuê", "wide"],
  building: ["건물 구조·용도", "Kết cấu và công năng"], areaM2: ["임차 면적 ㎡", "Diện tích thuê", "decimal"],
  leaseType: ["거래 종류", "Loại giao dịch", { depositRent: "보증금 있는 월세", jeonse: "전세", rent: "월세" }],
  contractType: ["계약의 종류", "Loại hợp đồng", { new: "신규 계약", renewed: "합의에 의한 재계약", statutory: "계약갱신요구권 행사" }],
  leaseFrom: ["임차주택 인도일", "Ngày bàn giao", "date"], leaseUntil: ["계약 종료일", "Ngày hết hạn", "date"],
  deposit: ["보증금 · 원", "Tiền đặt cọc", "amount"], firstPayment: ["계약금 · 원", "Tiền trả khi ký", "amount"],
  interimPayment: ["중도금 · 원", "Tiền trả đợt giữa", "amount"], interimDate: ["중도금 지급일", "Ngày trả đợt giữa", "date"],
  lastPayment: ["잔금 · 원", "Số tiền còn lại", "amount"], lastDate: ["잔금 지급일", "Ngày trả phần còn lại", "date"],
  rent: ["월세 · 원", "Tiền thuê hàng tháng", "amount"], rentDay: ["매월 월세 납부일", "Ngày trả tiền thuê", "day"],
  bills: ["정액 관리비 · 원", "Phí quản lý cố định", "amount"],
  lessor: ["임대인 성명·법인명", "Tên bên cho thuê"], lessorAddress: ["임대인 주소", "Địa chỉ bên cho thuê", "wide"],
  lessorArc: ["임대인 주민·외국인등록번호", "Số đăng ký bên cho thuê", "id"], lessorPhone: ["임대인 전화", "Điện thoại bên cho thuê", "tel"],
  tenantAddress: ["임차인 현재 주소", "Địa chỉ hiện tại của bên thuê", "wide"],
  contractSigned: ["계약서 작성일", "Ngày ký hợp đồng", "date"], leaseExtras: ["기타 합의 사항", "Thỏa thuận khác", "wide"],
};

const SESSION_ONLY = new Set(["fullName", "lastName", "givenName", "birth", "nationality", "sex", "arc", "passport", "phone",
  "provider", "providerNationality", "providerArc", "providerPhone", "company", "lessor", "lessorAddress",
  "lessorArc", "lessorPhone", "tenantAddress", "leaseExtras"]);
const officialSessions = new Map();

function officialSession(record) {
  if (!officialSessions.has(record.id)) {
    const saved = record.docs.official || {};
    officialSessions.set(record.id, { values: { ...saved.values }, kind: saved.kind || "county", sample: false });
  }
  return officialSessions.get(record.id);
}

function officialControl(key, values) {
  const [caption, , type = "text"] = OFFICIAL_FIELDS[key];
  const name = "of-" + key;
  const value = values[key] || "";
  const control = typeof type === "object" ? select(name, { "": "선택", ...type }, value)
    : type === "amount" ? input(name, "number", 'min="0" max="1000000000000" step="1" inputmode="numeric"', value)
    : type === "decimal" ? input(name, "number", 'min="0" max="99999" step="0.01" inputmode="decimal"', value)
    : type === "day" ? input(name, "number", 'min="1" max="31" step="1" inputmode="numeric"', value)
    : type === "id" ? input(name, "text", 'maxlength="14" inputmode="numeric" pattern="[0-9]{6}-?[0-9]{7}" placeholder="숫자 13자리"', value)
    : input(name, type === "wide" ? "text" : type, type === "date" ? 'min="1900-01-01" max="2199-12-31"'
      : "maxlength=" + (type === "wide" ? '"155"' : type === "tel" ? '"25"' : '"55"'), value);
  return field(caption, name, control, type === "wide");
}

function officialPanel(record) {
  const session = officialSession(record);
  const kinds = Object.fromEntries(Object.entries(OFFICIAL_FORMS).map(([key, form]) => [key, form.title]));
  return `<section class="rag-panel official-panel" aria-labelledby="official-title">
    <h3 id="official-title">AI 도토리 · 공식 서류 작성</h3>
    ${field("작성할 서식", "official-kind", select("official-kind", kinds, session.kind))}
    <div id="official-editor">${officialEditor(record, session)}</div>
  </section>`;
}

function missingOfficial(kind, values) {
  const fields = OFFICIAL_FORMS[kind].required.filter((key) => !values[key]);
  for (const [key, extra] of [["countyResidence", "countyOther"], ["relationship", "relationshipOther"], ["ownership", "ownershipOther"], ["stayType", "stayOther"]]) {
    if (OFFICIAL_FORMS[kind].fields.includes(key) && values[key] === "other" && !values[extra]) fields.push(extra);
  }
  return fields;
}

function officialCheck(record, session) {
  const missing = missingOfficial(session.kind, session.values);
  const vi = record.locale === "vi";
  const date = datesIn(session.values.moveOn || "")[0];
  const deadlines = date && ["county", "immigration"].includes(session.kind);
  const deadline = deadlines && new Date(Date.parse(date + "T00:00:00Z") + 15 * 86400000).toISOString().slice(0, 10);
  return `<p>${missing.length ? "작성할 항목 " + missing.length + "개 · " + missing.map((key) => OFFICIAL_FIELDS[key][0]).join(", ")
    : "화면의 주요 항목을 채웠습니다. PDF에서 원본 항목과 서명·날인을 확인하세요."}</p>
    ${missing.length && vi ? `<p lang="vi">Cần bổ sung: ${missing.map((key) => OFFICIAL_FIELDS[key][1]).join(", ")}.</p>` : ""}
    ${deadline ? `<p class="subtle">전입일 기준 15일 단순 계산 · ${deadline}. 실제 마감일과 접수 방법은 관할 기관에서 확인하세요.
      <a href="https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=12700000026" target="_blank" rel="noopener">정부24 신고 안내</a></p>` : ""}`;
}

function officialEditor(record, session) {
  const form = OFFICIAL_FORMS[session.kind];
  return `<form id="official-form" autocomplete="off">
    <div class="official-source">
      <p class="subtle">${form.no}</p>
      <div class="actions">
        <a class="text-link" href="/forms/${form.file}.pdf" target="_blank" rel="noopener">원본 양식 보기</a>
        <a class="text-link" href="${form.source}" target="_blank" rel="noopener">발급 기관</a>
        ${form.translation ? `<a class="text-link" href="${form.translation}" target="_blank" rel="noopener">베트남어 참고본</a>` : ""}
      </div>
    </div>
    <p class="subtle">${form.guide[0]}</p>
    ${record.locale === "vi" ? `<p class="subtle" lang="vi">${form.guide[1]}</p>` : ""}
    <div class="actions">
      <button class="button button-soft" data-action="official-prefill" type="button">AI 도토리로 상담 정보 채우기</button>
      <button class="text-button" data-action="${session.sample ? "official-clear-example" : "official-example"}" type="button">${session.sample ? "가상 예시 지우기" : "가상 예시 채우기"}</button>
    </div>
    <p id="official-feedback" class="subtle" role="status"></p>
    <details class="official-extract">
      <summary>계약·숙소제공 문구에서 읽기</summary>
      <label class="field" for="official-source-text">계약 조건이나 새 주소를 붙여 넣으세요.
        <textarea id="official-source-text" rows="4" maxlength="5000" placeholder="새 체류지 주소: 충청남도 서천군 …&#10;보증금 100만 원&#10;월세 30만 원"></textarea>
      </label>
      <button class="button button-soft" data-action="official-read" type="button">AI 도토리로 항목 읽기</button>
    </details>
    ${session.sample || record.channel === "demo" ? '<p class="note-block">시연용 입력값입니다. 내려받는 PDF에도 시연용으로 표시됩니다.</p>' : ""}
    <div class="form-grid official-grid">${form.fields.map((key) => officialControl(key, session.values)).join("")}</div>
    <div id="official-check" class="official-check" aria-live="polite">${officialCheck(record, session)}</div>
    <p class="subtle">성명·연락처·등록번호는 PDF 작성 중인 창에서만 사용합니다. 신청인 또는 권한 있는 담당자가 확인하고 서명·제출합니다.</p>
    <p class="form-error" data-error role="alert"></p>
    <div class="actions">
      <button class="button" type="submit">공식 양식 PDF 다운로드</button>
      ${canEditCaseDocuments(record) ? `<button class="button button-soft" data-action="official-save" type="button"${session.sample ? " disabled" : ""}>주소·일정·조건 저장</button>` : ""}
    </div>
  </form>`;
}

function renderOfficialEditor(message = "") {
  const record = currentRecord();
  const root = document.getElementById("official-editor");
  const choice = document.getElementById("official-kind");
  if (!record || !choice || !root) return;
  const session = officialSession(record);
  if (Object.hasOwn(OFFICIAL_FORMS, choice.value)) session.kind = choice.value;
  root.innerHTML = officialEditor(record, session);
  document.getElementById("official-feedback").textContent = message;
}

function rememberOfficialFields(form) {
  const record = currentRecord();
  if (!record) return;
  const session = officialSession(record);
  for (const key of OFFICIAL_FORMS[session.kind].fields) session.values[key] = form.elements[`of-${key}`].value.trim();
  document.getElementById("official-check").innerHTML = officialCheck(record, session);
}

function saveOfficialFields() {
  const record = currentRecord();
  const form = document.getElementById("official-form");
  if (!record || !form || !canEditCaseDocuments(record)) return;
  rememberOfficialFields(form);
  const { values, kind, sample } = officialSession(record);
  if (sample) return;
  const safeValues = Object.fromEntries(Object.entries(values).filter(([key]) => !SESSION_ONLY.has(key)));
  update((next) => {
    const target = next.cases.find((item) => item.id === record.id);
    if (!target || !canEditCaseDocuments(target)) return false;
    target.docs.official = { kind, values: safeValues };
    return true;
  });
  document.getElementById("official-feedback").textContent = "주소·일정·조건을 상담 기록에 반영했습니다. 저장 상태는 화면 상단에서 확인할 수 있습니다.";
}

function setMissingFields(values, found) {
  const inserted = [];
  for (const [key, value] of Object.entries(found)) {
    if (value == null || value === "" || values[key]) continue;
    values[key] = String(value);
    inserted.push(OFFICIAL_FIELDS[key][0]);
  }
  return inserted;
}

function fillOfficialFields(button) {
  const record = currentRecord();
  const form = button.form;
  if (!record || !form) return;
  const feedback = form.querySelector("#official-feedback");
  const { kind, sample } = officialSession(record);
  if (sample) {
    feedback.textContent = "상담 정보를 가져오려면 ‘가상 예시 지우기’를 선택해 주세요.";
    return;
  }

  const demo = record.channel === "demo";
  const home = selectedProposal(record, database)?.home;
  const usableHome = home?.ready && home.address && home.origin === (demo ? "demo" : "registered");
  const afterContract = ["docs", "submitted", "complete"].includes(record.stage);
  const draft = record.docs.draft;
  const reviewedAddress = draft?.housingText && (demo || !/가상|시연|예시/.test(draft.housingText)) ? draft.housingText : "";
  const found = {
    address: reviewedAddress || (usableHome ? home.address : ""),
    moveOn: reviewedAddress && afterContract && draft.dateType !== "planned" ? draft.plannedDate : "",
    ...(usableHome && (afterContract || demo) ? { deposit: home.deposit, rent: home.rent, bills: home.bills } : {}),
    ...(usableHome && demo ? {
      countyResidence: "lease", stayType: "private", leaseType: "depositRent",
      leaseFrom: home.from, leaseUntil: home.until,
    } : {}),
  };
  const filled = [];
  let alreadyEntered = false;
  for (const key of OFFICIAL_FORMS[kind].fields) {
    if (found[key] == null || found[key] === "") continue;
    const control = form.elements.namedItem("of-" + key);
    if (control.value.trim()) {
      alreadyEntered = true;
      continue;
    }
    control.value = String(found[key]);
    if (control.value) filled.push(OFFICIAL_FIELDS[key][0]);
  }
  rememberOfficialFields(form);
  feedback.textContent = filled.length ? filled.join(" · ") + " 항목을 채웠습니다."
    : alreadyEntered ? "상담 정보에 해당하는 칸에 이미 입력값이 있습니다."
      : "이 서식에 쓸 값을 담당자 검토 기록에 입력하거나 계약·숙소제공 문구에서 읽어 주세요.";
}

function datesIn(text) {
  return Array.from(text.matchAll(/(19\d{2}|20\d{2}|21\d{2})\s*(?:년\s*|[-./]\s*)(\d{1,2})\s*(?:월\s*|[-./]\s*)(\d{1,2})(?!\d)/g), ([, year, month, day]) =>
    `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().startsWith(date));
}

function amountIn(text) {
  const formatted = text.replace(/,/g, "").trim();
  const amount = formatted.match(/^(\d+(?:\.\d+)?)\s*([억만천])?\s*(?:원|won)?\s*$/i);
  if (!amount) return "";
  return Math.round(Number(amount[1]) * ({ 억: 100000000, 만: 10000, 천: 1000 }[amount[2]] ?? 1));
}

function extractOfficialFields() {
  const record = currentRecord();
  const text = document.getElementById("official-source-text")?.value || "";
  if (!record || !text.trim()) return;
  const session = officialSession(record);
  const found = {};
  const add = (key, value) => {
    if (value !== "" && value != null && !Object.hasOwn(found, key)) found[key] = value;
  };
  for (const line of text.split(/\r?\n/)) {
    const address = line.match(/^\s*(?:새\s*체류지\s*주소|주택\s*주소|숙소\s*주소|소재지|địa chỉ mới)(?:\s*[：:=]\s*|\s+)(.+)\s*$/i)
      || line.match(/^\s*(?:주소|소재지)\s*[:：=]\s*(.+)$/);
    if (address && address[1].length <= 155) add("address", address[1].trim());
    for (const [key, expression] of [["deposit", "보증금|tiền đặt cọc"], ["rent", "월세|차임|tiền thuê"], ["bills", "관리비|phí quản lý"]]) {
      const match = line.match(new RegExp("^\\s*(?:" + expression + ")\\s*[:：=]?\\s*([\\d,.]+\\s*[억만천]?\\s*(?:원|won)?)(?:\\s|$)", "i"));
      if (match) add(key, amountIn(match[1]));
    }
    if (/^\s*(?:임대차|계약|임차)\s*기간/.test(line)) {
      const [start, end] = datesIn(line);
      if (start && end && start < end) { add("leaseFrom", start); add("leaseUntil", end); }
    }
    if (/^\s*(?:실제\s*전입일|전입일|실제\s*입주일)/.test(line)) add("moveOn", datesIn(line)[0]);
    if (/^\s*(?:숙소\s*제공일|숙소\s*제공\s*시작일)/.test(line)) add("providedOn", datesIn(line)[0]);
    const provider = line.match(/^\s*(?:숙소\s*)?제공자\s*(?:성명)?\s*[:：=]\s*([^\d\r\n]{2,50})$/);
    if (provider) add("provider", provider[1].trim());
  }
  const inserted = setMissingFields(session.values, found);
  if (!inserted.length) {
    document.getElementById("official-feedback").textContent = "새로 옮길 항목이 없습니다. 예를 들어 주소·날짜·금액을 항목별로 한 줄씩 입력해 주세요.";
    return;
  }
  renderOfficialEditor(inserted.join(" · ") + " 항목을 읽었습니다. 값이 맞는지 확인하세요.");
}

function fillOfficialExample() {
  const record = currentRecord();
  if (!record) return;
  const session = officialSession(record);
  if (!session.sample && Object.values(session.values).some(Boolean)
    && !window.confirm("이 창의 입력값을 가상 예시로 바꿀까요?")) return;
  session.beforeSample = session.values;
  session.sample = true;
  session.values = {
    fullName: "NGUYEN VAN MAU", lastName: "NGUYEN", givenName: "VAN MAU", nationality: "베트남",
    sex: "male", arc: "000000-0000000", phone: "010-0000-0000", birth: "1998-09-12",
    address: "충청남도 서천군 가상로 1 (시연 주소)", countyResidence: "lease", moveOn: "2026-12-01", signDate: "2026-12-03",
    provider: "가상 제공자", providerNationality: "대한민국", providerArc: "000000-0000000",
    providerPhone: "010-0000-0000", relationship: "employer", ownership: "own", stayType: "dorm",
    providedOn: "2026-12-01", providedSigned: "2026-12-03", company: "가상 사업장",
    unit: "2층 201호", building: "철근콘크리트 주택", areaM2: "28.6", leaseType: "depositRent", contractType: "new",
    leaseFrom: "2026-12-01", leaseUntil: "2027-06-30", deposit: "1000000", firstPayment: "100000",
    lastPayment: "900000", lastDate: "2026-12-01", rent: "300000", rentDay: "1", bills: "35000",
    lessor: "가상 임대인", lessorAddress: "충청남도 서천군 가상로 10", tenantAddress: "충청남도 서천군 가상로 12",
    lessorArc: "000000-0000000", lessorPhone: "010-0000-0000", contractSigned: "2026-11-22",
    leaseExtras: "가상 예시 계약서",
  };
  renderOfficialEditor("가상 예시를 채웠습니다. PDF에서 기입 위치를 확인할 수 있습니다.");
}

function clearOfficialExample() {
  const record = currentRecord();
  if (!record) return;
  const session = officialSession(record);
  if (!session.sample) return;
  session.values = session.beforeSample;
  session.sample = false;
  delete session.beforeSample;
  renderOfficialEditor("가상 예시를 지우고 이전 입력을 복원했습니다.");
}

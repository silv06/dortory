const FIELD_MEMO_LIMIT = 1600;
const FIELD_MEMO_EXAMPLE = "별칭 보리. 장항산단에서 오전 8시 30분부터 오후 5시 30분까지 근무. 2027년 1월 12일 입주, 2027년 4월 30일 퇴거 예정. 2명이 살고 월 예산 45만 원. 베트남어로 문자 안내. 서천읍 시장 근처 주택과 환승 없는 귀가편 희망.";
const INTAKE_FIELDS = {
  alias: "이용자 별칭",
  locale: "안내 언어",
  contact: "연락 방법",
  moveIn: "희망 입주일",
  moveOut: "예상 거주 종료일",
  people: "거주 인원",
  budget: "월 예산",
  area: "근무지",
  workFrom: "근무 시작",
  workTo: "근무 종료",
  notes: "전달할 내용",
};
const INTAKE_AREAS = {
  janghang: [/(?:장항\s*(?:산단|(?:국가생태\s*)?산업단지)|khu cong nghiep janghang)/u, /장항|janghang/u],
  jongcheon: [/(?:종천\s*(?:농공단지|산단)|khu cong nghiep jongcheon)/u, /종천|jongcheon/u],
  seomyeon: [/(?:서면\s*수산|thuy san (?:tai )?seomyeon)/u, /서면|seomyeon/u],
  hwayang: [/(?:화양\s*농업|nong nghiep (?:tai )?hwayang)/u, /화양|hwayang/u],
};
const FIELD_DATE = /(?<!\d)(?:\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})(?!\d)/gu;
const DATE_KEYS = {
  moveOut: /예상\s*거주\s*종료일|거주\s*(?:종료|마감)(?:일)?|퇴거(?:일)?|퇴실(?:일)?|이사\s*나가(?:는\s*날)?|roi (?:di|nha)|chuyen di|ket thuc (?:luu tru|cu tru)/u,
  moveIn: /희망\s*입주일|입주(?:일)?|이사\s*(?:오는\s*날|들어오는\s*날)|거주\s*시작(?:일)?|(?:ngay )?(?:vao o|chuyen vao|nhan nha)/u,
};
const CLOCK_WORD = /(?<![\d:])(?:(?:오전|오후|새벽|아침|낮|저녁|밤|am|pm)\s*)?(?:\d{1,2}\s*:\s*\d{1,2}|\d{1,2}\s*(?:시(?:\s*\d{1,2}\s*분)?|(?:h(?![a-z])|gio)(?:\s*\d{1,2}\s*(?:phut)?)?))(?:\s+(?:sang|chieu|toi|dem|trua)\b)?(?![\d:])/giu;
const WORK_CONTEXT = /근무|일해|일하|직장|출근|퇴근|사업장|공장|lam viec|(?:^|\s)lam (?:o|tai|tu)\b|gio lam|ca lam|di lam|cong ty/u;
const PLACE_CONTEXT = /주택|주거|숙소|원룸|임대|집|아파트|(?:^|\s)(?:o gan|nha o|can ho|thue nha|phong tro)\b/u;
const AMOUNT_SOURCE = String.raw`(?<![\d+–.,-])(?:\d{1,3}(?:[,.]\d{3})+|\d+(?:[.,]\d+)?)\s*(?:(?:만(?:\s*\d{1,3}\s*천)?|천|trieu|nghin|ngan|k)\s*)?(?:원|won|krw|₩)?`;
const MONTHLY_PREFIX = /월\s*(?:예산|최대|부담|상한|한도)|한\s*달\s*(?:예산|최대|부담|한도)|월세\s*(?:예산|최대|한도)|ngan sach|chi phi\s*(?:hang thang|moi thang|thang)/u;
const MONTHLY_SUFFIX = /^(?:\s*\/\s*thang\b|\s*(?:moi thang|hang thang)\b)/u;
const SHIFT_START = /(?:근무\s*시작|출근(?:시간)?|bat dau ca|gio (?:bat dau|di lam))/u;
const SHIFT_END = /(?:근무\s*(?:종료|끝)|퇴근(?:시간)?|ket thuc ca|tan lam)/u;

function normalizeFieldMemo(value) {
  return value.normalize("NFKC").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/đ/g, "d").normalize("NFC");
}

function dateValue(text) {
  const parts = text.match(/\d+/g);
  const [year, month, day] = (parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]]).map(Number);
  const value = [String(year), String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value) ? value : null;
}

function relatedDateKey(text, side) {
  return Object.entries(DATE_KEYS).find(([, pattern]) => {
    const boundary = side === "before"
      ? String.raw`(?:\s*(?:은|는|이|가|을|를|예정(?:일)?|희망|[:=–-]|ngay))*\s*$`
      : String.raw`^\s*(?:에|부터|까지|부터는|den|se)?\s*`;
    return new RegExp(side === "before" ? "(?:" + pattern.source + ")" + boundary : boundary + "(?:" + pattern.source + ")", "u").test(text);
  })?.[0];
}

function collectStayDates(line, add) {
  const dates = [...line.matchAll(FIELD_DATE)];
  if (dates.length === 2 && /거주\s*기간|입주\s*기간|thoi gian (?:o|luu tru)/u.test(line)
    && /^\s*(?:~|–|부터\s*|den|-)\s*$/u.test(line.slice(dates[0].index + dates[0][0].length, dates[1].index))) {
    add("moveIn", dateValue(dates[0][0]));
    add("moveOut", dateValue(dates[1][0]));
    return;
  }
  let usedFollowingLabel = false;
  for (const [i, match] of dates.entries()) {
    const start = i ? dates[i - 1].index + dates[i - 1][0].length : 0;
    const before = line.slice(start, match.index);
    const after = line.slice(match.index + match[0].length, dates[i + 1]?.index);
    const left = usedFollowingLabel && !/[:=]\s*$/u.test(before) ? undefined : relatedDateKey(before, "before");
    const right = relatedDateKey(after, "after");
    const key = left || right;
    if (key) add(key, dateValue(match[0]));
    usedFollowingLabel = !left && Boolean(right);
  }
}

function clockValue(text) {
  const [hours, minutes = 0] = text.match(/\d+/g).map(Number);
  const night = /밤|\bdem\b/u.test(text);
  const morning = /오전|새벽|아침|\bam\b|\bsang\b/u.test(text) || night && hours === 12;
  const evening = /오후|낮|저녁|\bpm\b|\b(?:chieu|toi|trua)\b/u.test(text) || night && hours < 12;
  if (hours > 23 || minutes > 59 || ((morning || evening) && (hours < 1 || hours > 12)) || (morning && evening)) return null;
  const hour = evening ? hours % 12 + 12 : morning ? hours % 12 : hours;
  return String(hour).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
}

function shiftKey(text, side) {
  const test = (pattern) => new RegExp(side === "before"
    ? `(?:${pattern.source})(?:은|는|이|가|시각)?\\s*[:=]?\\s*$`
    : `^\\s*(?:에\\s*)?(?:${pattern.source})`, "u").test(text);
  if (test(SHIFT_START)) return "workFrom";
  if (test(SHIFT_END)) return "workTo";
}

function collectShift(line, add) {
  const times = [...line.matchAll(CLOCK_WORD)];
  const context = WORK_CONTEXT.test(line) || Object.values(INTAKE_AREAS).some(([site]) => site.test(line) && !PLACE_CONTEXT.test(line));
  const hasTravel = /버스|셔틀|통근편|귀가편|탑승|xe buyt|chuyen xe/u.test(line);
  let usedFollowingLabel = false;
  for (const [i, first] of times.entries()) {
    const second = times[i + 1];
    const before = line.slice(i ? times[i - 1].index + times[i - 1][0].length : 0, first.index);
    const after = line.slice(first.index + first[0].length, second?.index);
    if (second && (context || times.length === 2 && !before.trim() && !line.slice(second.index + second[0].length).trim())
      && !hasTravel && /^\s*(?:~|–|—|-|부터|에서|den|toi)\s*(?:다음\s*날\s*|hom sau\s*)?$/u.test(after)) {
      add("workFrom", clockValue(first[0]));
      add("workTo", clockValue(second[0]));
      continue;
    }
    if (hasTravel) continue;
    const left = usedFollowingLabel && !/[:=]\s*$/u.test(before) ? undefined : shiftKey(before, "before");
    const right = shiftKey(after, "after");
    const key = left || right;
    if (key) add(key, clockValue(first[0]));
    usedFollowingLabel = !left && Boolean(right);
  }
}

function budgetValue(amount) {
  const [number] = amount.match(/^\d+(?:[.,]\d+)*/u);
  const unit = amount.slice(number.length).trim();
  const digits = /^\d{1,3}(?:[,.]\d{3})+$/u.test(number) ? number.replace(/[,.]/g, "") : number.replace(",", ".");
  let value = Number(digits);
  if (/^만/u.test(unit)) value = value * 10000 + 1000 * Number(unit.match(/만\s*(\d+)\s*천/u)?.[1] || 0);
  else if (/^trieu\b/u.test(unit)) value *= 1000000;
  else if (/^(?:천|nghin\b|ngan\b|k\b)/u.test(unit)) value *= 1000;
  return Number.isInteger(value) && value >= 1 && value <= 10000000 ? String(value) : null;
}

function collectBudget(line, add) {
  const amounts = [...line.matchAll(new RegExp(AMOUNT_SOURCE, "gu"))];
  for (const [i, match] of amounts.entries()) {
    const left = line.slice(i ? amounts[i - 1].index + amounts[i - 1][0].length : 0, match.index);
    const right = line.slice(match.index + match[0].length);
    const prefix = MONTHLY_PREFIX.test(left) && !/보증금|보증료|급여|tien coc|luong/u.test(left);
    const bareMonth = /(?<!\d)\b(?:moi thang|hang thang)\s*$/u.test(left) || /(?<!\d)월\s*$/u.test(left);
    const hasUnit = /만|천|trieu|nghin|ngan|k\b|원|won|krw|₩/u.test(match[0]);
    if (!prefix && !(hasUnit && (bareMonth || MONTHLY_SUFFIX.test(right)))) continue;
    if (/^\s*(?:[~–—-]|에서|den)\s*\d/u.test(right)) add("budget", null);
    else add("budget", budgetValue(match[0]));
  }
}

function collectPeople(line, add) {
  const total = /(?:총\s*|본인\s*포함\s*|인원(?:은|이|수)?\s*[:=]?\s*|(?:tong cong|so nguoi(?: o)?)\s*[:=]?\s*)(\d{1,2})(?!\d)(?:\s*(?:명|인|nguoi))?/gu;
  const residents = /(?<![\d~.-])(\d{1,2})\s*(?:명|인|nguoi)\s*(?:이|이서|이 함께|이서 함께)?\s*(?:거주|입주|함께 살|살|o(?:\s|$)|se o|chuyen vao)/gu;
  const shorthand = /^(\d{1,2})\s*(?:명|인|nguoi)$/u.exec(line);
  const matches = [...line.matchAll(total), ...line.matchAll(residents)];
  if (shorthand) matches.push(shorthand);
  for (const match of matches) {
    const count = Number(match[1]);
    const next = line.slice(match.index + match[0].length);
    const prior = line.slice(0, match.index);
    const range = /^\s*[~–-]\s*\d/u.test(next) || /\d\s*[~–-]\s*$/u.test(prior);
    add("people", !range && count >= 1 && count <= 12 ? String(count) : null);
  }
  if (/(?:혼자\s*(?:거주|입주|살)|(?:o|song) mot minh)/u.test(line)) add("people", "1");
}

function fieldWorkArea(line, site, area) {
  const matches = line.matchAll(new RegExp(site.source + "|" + area.source, "gu"));
  for (const match of matches) {
    const before = line.slice(Math.max(0, match.index - 45), match.index);
    const after = line.slice(match.index + match[0].length);
    if (/(?:근무지|직장|사업장|(?:lam viec|di lam)\s*(?:o|tai)?)\s*[:=]?\s*$/u.test(before)
      || /^\s*(?:읍|면)?(?:에서|으로|에)?\s*(?:근무|출근|일하|일해|lam viec)/u.test(after)) return true;
    if (!PLACE_CONTEXT.test(line) && (site.test(match[0]) || WORK_CONTEXT.test(line))) return true;
  }
  return false;
}

function requestedLanguage(line, pattern) {
  for (const match of line.matchAll(pattern)) {
    const after = line.slice(match.index + match[0].length);
    const before = line.slice(0, match.index);
    if (/^(?:(?:은|는|를|가|도)\s*)?\s*(?:못|불가|어렵|미사용|말고)/u.test(after)) continue;
    if (/(?:khong|chua)\s+(?:(?:noi|biet|dung|su dung)\s+)?$/u.test(before)) continue;
    return true;
  }
  return false;
}

function fieldPreferenceNotes(lines) {
  const preferred = lines.filter((line) => !/원하지|제외|싫|khong muon/u.test(line));
  const housing = preferred.filter((line) => PLACE_CONTEXT.test(line) || /시장\s*(?:권|근처|인근|생활권)|gan (?:khu )?cho/u.test(line));
  const { district, market } = readHousingPreference(housing.join(" "));
  const { direct, time, return: returnTrip, cost } = readHousingPreference(preferred.join(" "));
  return [
    market ? "서천읍 시장 근처 희망" : district ? district + " 생활권 희망" : "",
    direct ? "퇴근 후 환승 없는 귀가편 희망" : "",
    time ? "귀가 시간 짧은 통근편 희망" : "",
    returnTrip && !direct && !time ? "퇴근 후 귀가편 확인" : "",
    cost ? "낮은 비용 우선" : "",
  ].filter(Boolean).join(" · ");
}

function readFieldMemo(memo) {
  const candidates = new Map();
  const add = (key, value) => {
    if (!candidates.has(key)) candidates.set(key, new Set());
    candidates.get(key).add(value);
  };
  const parts = memo.slice(0, FIELD_MEMO_LIMIT).split(/[\r\n;!?]+|,(?!\d)|(?<!\d)\.(?=\s|$)/u).map((part) => part.trim()).filter(Boolean);
  const lines = parts.map(normalizeFieldMemo);
  for (const [i, line] of lines.entries()) {
    const alias = parts[i].match(/^(?:이용자\s*)?(?:별칭|닉네임|가명|biệt danh|tên gọi|biet danh|ten goi)(?:은|는)?\s*[:=]?\s*(.+)$/iu)?.[1]
      ?.replace(/(?:입니다|이에요|예요)$/u, "").trim().replace(/^["'“‘]|["'”’]$/gu, "");
    if (alias) add("alias", alias.length <= 30 && !/[@\r\n]|\d{5,}/u.test(alias) ? alias : null);
    if (requestedLanguage(line, /한국어|tieng han\b/gu)) add("locale", "ko");
    if (requestedLanguage(line, /베트남어|tieng viet\b/gu)) add("locale", "vi");
    if (/문자(?:로| 안내| 연락|$)|\bsms\b|tin nhan/u.test(line) && !/문자\s*말고|khong (?:gui )?tin nhan/u.test(line)) add("contact", "message");
    if (/대면|직접\s*상담|현장\s*상담\s*(?:희망|선호)|(?:lien he|tu van) truc tiep/u.test(line)) add("contact", "onsite");
    for (const [key, [site, area]] of Object.entries(INTAKE_AREAS)) {
      if (fieldWorkArea(line, site, area)) add("area", key);
    }
    collectStayDates(line, add);
    collectShift(line, add);
    collectBudget(line, add);
    collectPeople(line, add);
  }
  const fields = {};
  const review = {};
  for (const [key, values] of candidates) {
    if (values.size > 1) review[key] = "값이 여러 개입니다";
    else if (values.has(null)) review[key] = "값이나 입력 범위를 확인해 주세요";
    else fields[key] = [...values][0];
  }
  if (fields.moveIn && fields.moveOut && fields.moveIn >= fields.moveOut) {
    delete fields.moveIn;
    delete fields.moveOut;
    review.moveOut = "거주 종료일이 입주일 이후인지 확인해 주세요";
  }
  if (fields.workFrom && fields.workFrom === fields.workTo) {
    delete fields.workFrom;
    delete fields.workTo;
    review.workTo = "시작과 종료 시간이 같아 다시 확인이 필요합니다";
  }
  const notes = fieldPreferenceNotes(lines);
  if (notes) fields.notes = notes;
  return { fields, review };
}

function fieldIntakeAssistant() {
  return `<form id="field-assist-form" class="paper field-assistant" aria-labelledby="field-assist-title">
    <h2 id="field-assist-title">AI 도토리로 현장 상담 정리</h2>
    <p class="subtle">한국어·베트남어 상담 메모에서 주거 조건과 근무 정보를 읽어 접수 양식을 채웁니다.</p>
    ${field("현장 상담 메모", "fieldMemo", `<textarea id="fieldMemo" name="memo" rows="5" maxlength="${FIELD_MEMO_LIMIT}" required
      placeholder="예시에서 메모 형식을 확인할 수 있습니다. 별칭과 상담 조건을 적어 주세요."></textarea>`)}
    <div class="actions">
      <button class="button" type="submit">메모에서 항목 채우기</button>
      <button class="button button-soft" type="button" data-action="field-memo-example">예시 넣기</button>
    </div>
    <p class="field-assist-result" data-field-result role="status" aria-live="polite"></p>
    <ul class="field-assist-review" data-field-review hidden></ul>
  </form>`;
}

function fillFieldExample() {
  const memo = document.getElementById("fieldMemo");
  if (!memo) return;
  if (!memo.value.trim()) {
    memo.value = FIELD_MEMO_EXAMPLE;
    memo.dispatchEvent(new Event("input", { bubbles: true }));
  }
  memo.focus();
}

function fillFieldDraft(assistantForm, memo) {
  const form = document.getElementById("apply-form");
  if (!form || form.getAttribute("aria-busy") === "true") return;
  const { fields, review } = readFieldMemo(memo);
  const result = assistantForm.querySelector("[data-field-result]");
  const list = assistantForm.querySelector("[data-field-review]");
  const filled = [];
  const kept = [];
  for (const [key, label] of Object.entries(INTAKE_FIELDS)) {
    const control = form.elements.namedItem(key);
    if (control.value && !Object.hasOwn(control.dataset, "assistValue")) {
      if (fields[key] && fields[key] !== control.value) kept.push(label);
      continue;
    }
    if (fields[key]) {
      control.value = fields[key];
      control.dataset.assistValue = control.value;
      filled.push(label);
    } else if (Object.hasOwn(control.dataset, "assistValue")) {
      control.value = "";
      delete control.dataset.assistValue;
    }
  }
  if (filled.length) dirtyForms.add(form.id);
  result.textContent = filled.length
    ? `${filled.length}개 항목을 채웠습니다. 아래 입력 내용을 확인한 뒤 저장하세요.`
    : "새로 채운 항목이 없습니다. 메모에 구체적인 항목을 적거나 아래 양식에 직접 입력하세요.";
  const missing = Object.entries(INTAKE_FIELDS).filter(([key]) => key !== "notes" && !form.elements.namedItem(key).value);
  const messages = Object.entries(review).map(([key, message]) => `${INTAKE_FIELDS[key]} · ${message}`);
  if (missing.length) messages.push("추가 입력 필요 · " + missing.map(([, label]) => label).join(", "));
  if (kept.length) messages.push("직접 입력 유지 · " + kept.join(", "));
  list.replaceChildren(...messages.map((message) => {
    const item = document.createElement("li");
    item.textContent = message;
    return item;
  }));
  list.hidden = messages.length === 0;
}

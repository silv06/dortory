function ragStatus() {
  return '<p class="subtle rag-status" data-rag-state>공식 자료를 확인하는 중…</p>';
}

let ragStatusRequest;
async function updateRagStatus() {
  const targets = main.querySelectorAll("[data-rag-state]");
  if (!targets.length) return;
  try {
    ragStatusRequest ??= fetch("/api/rag/status").then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).catch(() => { ragStatusRequest = undefined; throw new Error(); });
    const { sources, units, as_of } = await ragStatusRequest;
    for (const target of targets) target.textContent = "공식 출처 " + sources + "곳 · 검색 근거 " + units + "건 · " + as_of + " 기준";
  } catch {
    for (const target of targets) target.textContent = "공식 자료 연결을 확인해 주세요.";
  }
}

function ragEvidence(sources) {
  if (!sources?.length) return "";
  return `<details class="rag-evidence">
    <summary>공식 근거 ${sources.length}개 보기</summary>
    <ul>${sources.map((source) => `<li>
      <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.title)}</a>
      <p class="subtle">${escapeHtml(source.publisher)} · ${escapeHtml(source.date)} · ${escapeHtml(source.locator)}</p>
      <p>${escapeHtml(source.text)}</p>
    </li>`).join("")}</ul>
  </details>`;
}

function ragSearchPanel(inCase = false) {
  const form = `<form id="rag-search-form">
      ${ragStatus()}
      ${field("질문", "ragQuestion", input("ragQuestion", "search", 'required maxlength="650" placeholder="예: 체류지 변경은 며칠 안에 신고하나요?"'))}
      <button class="button button-soft" type="submit">근거 검색</button>
      <p class="form-error" data-error role="alert"></p>
      <div class="rag-result" data-rag-result aria-live="polite"></div>
    </form>`;
  return inCase ? `<section class="paper assistant-card rag-panel">
    <h3>공식 근거 검색</h3>${form}</section>`
    : `<details class="paper rag-panel"><summary>공식 자료·서식 검색</summary>${form}</details>`;
}

function readHousingPreference(notes = "") {
  const query = notes.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").normalize("NFC");
  const market = /시장\s*(?:생활\s*권|권|근처|인근)|서천\s*시장|gan (?:khu )?cho|khu cho/.test(query);
  const district = market ? "서천읍" : Object.values(HOUSING_DISTRICTS).find((place) => query.includes(place));
  const priorities = {
    district,
    market,
    direct: /무\s*환승|직행|환승[이을]?\s*(?:없는|없이|줄|적은)|갈아\s*타지|한\s*번에\s*(?:집|가)|khong (?:can )?(?:doi|chuyen) xe/.test(query),
    time: /빨리\s*(?:집|귀가)|짧은\s*(?:귀가|통근)|귀가.{0,8}(?:짧|빠르)|ve nha nhanh/.test(query),
    return: /귀가|퇴근\s*(?:뒤|후|이후)|돌아오는\s*(?:차량|차|편)|ve nha sau|chuyen ve/.test(query),
    cost: /저렴|낮은\s*(?:비용|월세)|(?:월세|비용)\s*(?:우선|먼저)|gia re|tiet kiem/.test(query),
  };
  priorities.labels = [
    market ? "서천읍 시장 생활권" : district,
    priorities.direct && "환승 적은 귀가편", priorities.time && "퇴근 후 빠른 귀가",
    priorities.return && "퇴근 후 귀가편 확인", priorities.cost && "낮은 월 부담",
  ].filter(Boolean);
  return priorities;
}

const barriers = { reserved: 30, space: 8, dates: 8, budget: 5, cost: 4, link: 4, shift: 3, route: 3, home: 2, return: 2, verify: 2, seats: 2 };
const known = (value) => Number.isFinite(value) ? value : Infinity;

function rankHousing(record, options) {
  const notes = record.matchPreference ?? record.notes ?? "";
  const preference = readHousingPreference(notes);
  const locationScore = (home) => preference.district && HOUSING_DISTRICTS[home.area] === preference.district ? 2
    : HOUSING_DISTRICTS[home.area] === HOUSING_DISTRICTS[record.area] ? 1 : 0;
  const preferenceOrder = (a, b) =>
    locationScore(b.home) - locationScore(a.home)
    || (preference.direct && known(a.route?.transfers) - known(b.route?.transfers))
    || (preference.time && known(a.returnMinutes) - known(b.returnMinutes))
    || (preference.return && Number(Boolean(b.route?.ready && b.route?.inbound)) - Number(Boolean(a.route?.ready && a.route?.inbound)))
    || known(a.monthly) - known(b.monthly) || a.home.name.localeCompare(b.home.name, "ko");
  const hurdles = (row) => row.reasons.reduce((sum, reason) => sum + (barriers[reason] ?? 2), 0);
  const seen = new Set();
  const uniqueHomes = (rows) => rows.filter(({ home }) => {
    if (seen.has(home.id)) return false;
    seen.add(home.id);
    return true;
  });
  const manual = options.filter(({ home }) => home.origin !== "public");
  const confirmed = uniqueHomes(manual.filter(({ eligible }) => eligible).sort(preferenceOrder));
  const pending = uniqueHomes(manual.filter(({ eligible }) => !eligible)
    .sort((a, b) => hurdles(a) - hurdles(b) || preferenceOrder(a, b)));
  const inventoryRank = (home) => home.source?.type === "매매" ? 2 : home.source?.type === "아파트 현황" ? 1 : 0;
  const inventory = options.filter(({ home }) => home.origin === "public").map(({ home }) => home)
    .sort((a, b) => inventoryRank(a) - inventoryRank(b) || locationScore(b) - locationScore(a)
      || Number(!a.source?.phone) - Number(!b.source?.phone) || a.name.localeCompare(b.name, "ko"));
  return { notes, preference, confirmed, pending, inventory };
}

function ragMatchPanel(record, match) {
  const tags = match.preference.labels;
  return `<section class="match-preferences" aria-labelledby="rag-match-title">
    <h3 id="rag-match-title" tabindex="-1">상담 메모에서 선호 읽기</h3>
    <form id="rag-match-form" class="assistant-form">
      ${field("주거·통근 메모", "ragPreference", '<textarea id="ragPreference" name="ragPreference" maxlength="2000" rows="4" placeholder="예: 서천읍 시장 근처, 퇴근 후 환승 없는 귀가편">' + escapeHtml(match.notes) + '</textarea>')}
      <button class="button button-soft" type="submit">선호 분석하고 반영</button>
      <p class="form-error" data-error role="alert"></p>
    </form>
    ${tags.length ? '<ul class="preference-list" aria-label="반영한 선호">' + tags.map((tag) => '<li>' + escapeHtml(tag) + '</li>').join("") + '</ul>'
      : '<p class="subtle">메모에 생활권·비용·귀가시간·환승 선호가 있으면 비교 순서에 반영합니다.</p>'}
  </section>`;
}

function caseAssistant(record, data) {
  const placement = selectedProposal(record, data);
  const eligible = Boolean(eligiblePlacement(record, data));
  const base = `#/staff/cases/${escapeHtml(record.id)}`;
  const notes = record.matchPreference ?? record.notes ?? "";
  const preference = readHousingPreference(notes);
  const reviewing = record.stage === "reviewing";

  return `<section class="case-assistant" aria-labelledby="assistant-title">
    <div class="assistant-header"><h2 id="assistant-title">AI 도토리</h2></div>
    <section class="paper case-panel">
      <h3>선택한 조합 검토</h3>
      ${placement ? `<p><strong>${escapeHtml(placement.home.name)}</strong> · ${escapeHtml(placement.route.name || "왕복 통근편")}</p>
        <p class="subtle">월 예상 부담 ${money(placement.monthly ?? placement.home.rent + placement.home.bills + placement.route.cost)}
          · 퇴근 ${escapeHtml(record.workTo)} · 귀가편 출발 ${escapeHtml(placement.route.inbound || "확인 필요")}</p>`
        : '<p>선택 조합 기록을 주택·통근 비교에서 확인해 주세요.</p>'}
      ${reviewing && !eligible ? '<p class="note-block">대장의 임대 조건이나 왕복편이 변경됐습니다. 비교에서 확인한 뒤 이어서 진행하세요.</p>' : ""}
      <a class="text-link" href="${base}/compare">주택·통근 비교 열기</a>
    </section>
    <div class="assistant-grid">
      ${reviewing ? `<section class="paper assistant-card assistant-match">${ragMatchPanel(record, { notes, preference })}</section>` : ""}
      ${ragSearchPanel(true)}
    </div>
    ${reviewing ? `<div class="actions case-step-action"><button class="button" data-action="finish-ai-review" type="button"${eligible ? "" : " disabled"}>AI 검토 확인 후 입주 서류 작성</button></div>` : ""}
  </section>`;
}

async function submitRag(form, values, submitter) {
  if (form.id === "rag-match-form") {
    const record = currentRecord();
    if (record?.stage !== "reviewing") return;
    const preference = values.ragPreference.trim();
    dirtyForms.delete(form.id);
    if (preference === (record.matchPreference ?? record.notes)) refresh("", "#rag-match-title");
    else editCurrent((next) => {
      next.matchPreference = preference;
      return true;
    }, { message: "비교에 선호를 반영했습니다.", focus: "#rag-match-title" });
    return;
  }
  if (form.id !== "rag-search-form") return;
  const result = form.querySelector("[data-rag-result]");
  const error = form.querySelector("[data-error]");
  error.textContent = "";
  submitter.disabled = true;
  try {
    const response = await fetch("/api/rag/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: values.ragQuestion }), signal: AbortSignal.timeout(10000) });
    const answer = await response.json();
    if (!response.ok) throw new Error(answer.error);
    result.innerHTML = "<p>" + escapeHtml(answer.answer) + "</p>" + ragEvidence(answer.evidence);
  } catch {
    error.textContent = "공식 자료 검색에 연결하지 못했습니다. 다시 시도해 주세요.";
  } finally {
    submitter.disabled = false;
  }
}

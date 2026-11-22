const WORK_CHOICES = {
  janghang: { ko: "장항산단", vi: "Janghang" },
  jongcheon: { ko: "종천", vi: "Jongcheon" },
  seomyeon: { ko: "서면", vi: "Seomyeon" },
  hwayang: { ko: "화양", vi: "Hwayang" },
};

const HOME_GROUPS = {
  market: { ko: "서천읍", vi: "Thị trấn Seocheon" },
  seomyeon: { ko: "서면", vi: "Seomyeon" },
  hwayang: { ko: "화양", vi: "Hwayang" },
  ...Object.fromEntries(Object.entries(HOUSING_AREAS).filter(([key]) => !["market", "south", "seomyeon", "hwayang"].includes(key))),
};

function dashboardRoute(path, values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && value !== "all") params.set(key, value);
  }
  return params.size ? `${path}?${params}` : path;
}

function chosenArea(params, catalog = WORK_AREAS) {
  const area = params.get("area");
  return Object.hasOwn(catalog, area) ? area : "";
}

function dashboardNavigation(path, staff, entered) {
  if (staff && !entered) return "";
  const tabs = staff ? [
    ["/staff", "업무함", path === "/staff" || path.startsWith("/staff/cases/")],
    ["/staff/resources/homes", "주택·통근 대장", path.startsWith("/staff/resources")],
    ["/staff/logs", "활동 로그", path === "/staff/logs"],
  ] : [
    ["/dashboard", label("지도", "Bản đồ"), path === "/dashboard"],
    ["/apply", label("상담 신청", "Đăng ký"), path === "/apply" || path === "/apply/complete"],
    ["/my-case", label("내 상담", "Hồ sơ của tôi"), path === "/my-case"],
  ];
  return `<nav class="workspace-nav" aria-label="${label("대시보드 메뉴", "Menu bảng điều khiển")}">
    ${tabs.map(([target, caption, current]) => navLink(target, current, caption)).join("")}
  </nav>`;
}

function dashboardFrame(path, staff, entered, map, panel) {
  const inboxMap = staff && entered && Boolean(map);
  return `<div class="workspace">
    ${dashboardNavigation(path, staff, entered)}
    <div class="workspace-grid${inboxMap ? " workspace-inbox" : map ? "" : " workspace-single"}">
      ${map ? `<section id="workspace-map" class="workspace-map" aria-label="${inboxMap ? "상담 거점 지도" : label("서천군 지도", "Bản đồ Seocheon")}">${map}</section>` : ""}
      <section id="workspace-panel" class="workspace-panel" tabindex="0" aria-label="${label("상담 작업 패널", "Bảng thao tác tư vấn")}">${panel}</section>
    </div>
  </div>`;
}

function areaLinks(path, labels, active = "", extras = {}, includeAll = false) {
  const options = includeAll ? [["", { ko: "전체 권역", vi: "Tất cả khu vực" }], ...Object.entries(labels)] : Object.entries(labels);
  return `<nav class="area-links" aria-label="${label("권역 선택", "Chọn khu vực")}">
    ${options.map(([key, place]) => navLink(dashboardRoute(path, { ...extras, area: key }), key === active, localize(place))).join("")}
  </nav>`;
}

function publicOverview(area) {
  const links = areaLinks("/dashboard", WORK_CHOICES, area, Boolean(area) ? {} : undefined, Boolean(area));
  return `<div class="wrap page">
    ${pageHead(area ? localize(WORK_AREAS[area]) : label("서천 주거 상담", "Tư vấn nhà ở Seocheon"),
      area ? "" : label("근무 권역을 선택하고 주거 상담을 신청하세요.", "Chọn nơi làm việc và đăng ký tư vấn nhà ở."))}
    ${links}
    <a class="button" href="#${escapeHtml(dashboardRoute("/apply", { area }))}">${label("주거 상담 신청", "Đăng ký tư vấn")} ${nextArrow}</a>
  </div>`;
}

function workPins(path = "", extras = {}, counts = null) {
  return Object.entries(WORK_AREAS).map(([area, place]) => ({
    key: area,
    coord: MAP_WORK[area],
    name: localize(WORK_CHOICES[area]),
    fullName: localize(place),
    count: counts ? counts.get(area) ?? 0 : null,
    href: path ? `#${dashboardRoute(path, { ...extras, area })}` : "",
  }));
}

function publicWorkspaceMap(area) {
  return overviewMap(workPins("/dashboard"), {
    selected: area, note: label("근무지 선택", "Chọn nơi làm việc"),
  });
}

function workContextMap(area, status = "") {
  const pin = workPins().find((option) => option.key === area);
  return overviewMap(pin ? [pin] : workPins(), {
    selected: pin?.key || "", focused: Boolean(pin), note: pin ? pin.fullName : "",
    status,
  });
}

function staffCaseRows(data, filter, area = "") {
  const rule = STAFF_FILTERS[filter] || STAFF_FILTERS.all;
  return data.cases.filter((record) => record.channel !== "demo" && (!area || record.area === area) && rule.show(record));
}

function staffWorkspaceMap(data, filter, area) {
  const counts = new Map();
  for (const record of staffCaseRows(data, filter)) {
    counts.set(record.area, (counts.get(record.area) ?? 0) + 1);
  }
  return overviewMap(workPins("/staff", { filter }, counts), {
    selected: area,
    note: "근무지별 상담 건수",
    action: areaLinks("/staff", {}, area, { filter }, true),
  });
}

function homeResourceGroup(item) {
  return item.area === "south" ? "market" : item.area;
}

const SEOCHEON_MAP = {
  width: 1800, height: 1100,
  west: 126.485, east: 126.817, south: 36.009, north: 36.173,
};

// Representative points for the demo. These plot areas and example stops.
const MAP_HOMES = {
  market: [126.68682, 36.07502],
  south: [126.6886, 36.067],
  seomyeon: [126.546, 36.1495],
  hwayang: [126.754, 36.041],
};

const MAP_STOPS = {
  market: [126.6818, 36.0712],
  south: [126.6844, 36.0641],
};

const MAP_WORK = {
  janghang: [126.671, 36.0418],
  jongcheon: [126.6725, 36.1115],
  seomyeon: [126.557, 36.148],
  hwayang: [126.7665, 36.038],
};

const MAP_BENDS = {
  janghang: [[126.6793, 36.0575], [126.6765, 36.0474]],
  jongcheon: [[126.6745, 36.082], [126.678, 36.0962]],
};

const MAP_STATES = {
  example: { ko: "매칭 예시", vi: "Ví dụ ghép nhà" },
  review: { ko: "후보 검토", vi: "Đang xem xét" },
  pending: { ko: "확인 대기", vi: "Chờ xác nhận" },
  offered: { ko: "주거 제안", vi: "Đã có đề xuất" },
  visit: { ko: "방문 요청", vi: "Đã yêu cầu xem nhà" },
  matched: { ko: "매칭 완료", vi: "Đã xác nhận nhà ở" },
};

function confirmedHousing(record) {
  return Boolean(record.homeId) && ["docs", "submitted", "complete"].includes(record.stage);
}

function selectedProposal(record, data) {
  const sent = record.offers.find((offer) => offer.homeId === record.homeId
    && (!record.transitId || offer.transitId === record.transitId));
  if (sent) return latestProposal(sent, data);

  // Earlier seed cases already had a selected house but no stored proposal.
  const home = data.homes.find((item) => item.id === record.homeId);
  const route = data.transits.find((item) => item.home === home?.area && item.work === record.area
    && (!record.transitId || item.id === record.transitId) && item.ready && item.inbound);
  return home && route ? { home, route } : null;
}

function mapOptionsFor(record, data, audience) {
  if (record.stage === "visit" || confirmedHousing(record)) {
    const selected = selectedProposal(record, data);
    return selected && mapPoints(selected.route).length ? [{ ...selected, status: record.stage === "visit" ? "visit" : "matched" }] : [];
  }
  if (audience === "worker") {
    return record.offers.map((offer) => latestProposal(offer, data)).filter((option) => option && mapPoints(option.route).length)
      .map((option) => ({ ...option, status: "offered" }));
  }
  return candidateOptions(record, data).filter(({ route }) => route && mapPoints(route).length).map((option) => {
    const sent = record.offers.find((offer) => offer.homeId === option.home.id && offer.transitId === option.route.id);
    return sent
      ? { ...latestProposal(sent, data), status: "offered" }
      : { home: option.home, route: option.route, status: option.eligible ? "review" : "pending" };
  });
}

function mapOptionKey(option) {
  return `${option.home.id}/${option.route.id}`;
}

function mapHomeName(home) {
  return escapeHtml(uiLanguage === "vi" ? home.nameVi || home.name : home.name);
}

function mapPoints(route) {
  const walk = isWalkingRoute(route);
  const home = MAP_HOMES[route.home];
  const work = MAP_WORK[route.work];
  if (!home || !work) return [];
  const stop = walk ? null : MAP_STOPS[route.home] || [home[0] + .004, home[1] - .0035];
  return [
    { kind: "home", coord: home, title: label("주택", "Nhà") },
    ...(stop ? [{ kind: "pickup", coord: stop, title: label("승차", "Điểm đón") }] : []),
    { kind: "work", coord: work, title: label("일터", "Nơi làm") },
  ];
}

function matchMap(option) {
  const { home, route, status } = option;
  const points = mapPoints(route);
  if (!points.length) return "";
  const stop = points.find((point) => point.kind === "pickup");
  return `<figure class="match-map" data-match-status="${status}">
    <div class="map-status-line">
      ${statusTag(localize(MAP_STATES[status]), ["example", "matched"].includes(status) ? "done" : status === "pending" ? "attention" : "working")}
      <span>${label("권역 기준 시연 경로", "Lộ trình minh họa theo khu vực")}</span>
    </div>
    <div class="map-frame" data-map-frame data-home-area="${route.home}" data-work-area="${route.work}" data-walk="${isWalkingRoute(route)}">
      <div class="map-scene" aria-hidden="true">
        <img class="map-base" src="./assets/seocheon-basemap.webp" width="3600" height="2200" alt="">
        <canvas class="map-connection"></canvas>
        <div class="map-pins">
          ${points.map(({ kind, title }) => `<span class="map-point point-${kind}"><span class="map-dot"></span><span class="map-point-label">${title}</span></span>`).join("")}
        </div>
      </div>
      <button type="button" class="map-view" data-map-view aria-pressed="false">${label("권역 보기", "Xem toàn khu")}</button>
      <a class="map-credit" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
    </div>
    <figcaption class="map-description">
      <dl class="map-places">
        <div><dt><i class="map-key key-home" aria-hidden="true"></i>${label("주택", "Nhà ở")}</dt><dd>${mapHomeName(home)}</dd></div>
        ${stop ? `<div><dt><i class="map-key key-pickup" aria-hidden="true"></i>${label("승차 지점", "Điểm đón")}</dt><dd>${label("공동 통근차량", "Xe đưa đón")}</dd></div>` : ""}
        <div><dt><i class="map-key key-work" aria-hidden="true"></i>${label("일터", "Nơi làm việc")}</dt><dd>${localize(WORK_AREAS[route.work])}</dd></div>
      </dl>
      ${status === "pending" && !route.inbound ? `<p>${label("퇴근 후 귀가편을 확인 중입니다.", "Đang xác nhận chuyến về sau ca làm.")}</p>` : ""}
    </figcaption>
  </figure>`;
}

function caseMapPanel(options, audience, preferred = "") {
  if (!options.length) return "";
  const current = options.find((item) => mapOptionKey(item) === preferred) || options[0];
  return `<div class="case-map-panel">
    ${options.length > 1 ? `<div class="map-choice-bar">
        <label for="${audience}-map-choice">${label("지도에 표시할 주택", "Nhà hiển thị trên bản đồ")}</label>
        <select id="${audience}-map-choice" data-case-map="${audience}">
          ${options.map((item) => `<option value="${escapeHtml(mapOptionKey(item))}"${item === current ? " selected" : ""}>${mapHomeName(item.home)} · ${localize(MAP_STATES[item.status])}</option>`).join("")}
        </select>
      </div>` : ""}
    <div class="workspace-route" id="${audience}-map-content">${matchMap(current)}</div>
  </div>`;
}

function overviewMap(pins, { selected = "", focused = false, note = "", status = "", action = "" } = {}) {
  return `<figure class="match-map overview-map" data-match-status="overview">
    <figcaption class="map-status-line">
      <strong>${label("서천군", "Seocheon")}</strong>
      ${status ? statusTag(escapeHtml(status)) : ""}
      ${note ? `<span>${escapeHtml(note)}</span>` : ""}
      ${action}
    </figcaption>
    <div class="map-frame overview-frame" data-map-frame data-overview="${focused ? "focused" : "region"}">
      <div class="map-scene"><img class="map-base" src="./assets/seocheon-basemap.webp" width="3600" height="2200" alt=""></div>
      <div class="map-regions">
        ${pins.map((pin) => {
          const active = pin.key === selected;
          const node = pin.href ? "a" : "span";
          const destination = pin.href ? ` href="${escapeHtml(pin.href)}" aria-label="${escapeHtml(pin.fullName)}${pin.count == null ? "" : ` · ${pin.count}건`}"${active ? ' aria-current="location"' : ""}` : "";
          return `<${node} class="map-area-pin${active ? " is-current" : ""}" data-map-area="${pin.key}" data-point="${pin.coord.join(",")}"${destination}>
            <span class="map-area-dot" aria-hidden="true"></span>
            <span class="map-area-label">${escapeHtml(pin.name)}${pin.count == null ? "" : ` <strong class="tabular">${pin.count}건</strong>`}</span>
          </${node}>`;
        }).join("")}
      </div>
    </div>
    <a class="map-credit" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
  </figure>`;
}

function projectMap([longitude, latitude]) {
  const frame = SEOCHEON_MAP;
  return [
    ((longitude - frame.west) / (frame.east - frame.west)) * frame.width,
    ((frame.north - latitude) / (frame.north - frame.south)) * frame.height,
  ];
}

function mapViewFor(points, width, height, region, context = [140, 115]) {
  if (region) {
    const scale = Math.min(width / SEOCHEON_MAP.width, height / SEOCHEON_MAP.height);
    return {
      scale, left: (width - SEOCHEON_MAP.width * scale) / 2,
      top: (height - SEOCHEON_MAP.height * scale) / 2,
    };
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const padding = Math.min(66, width * .2, height * .22);
  const scale = Math.min((width - 2 * padding) / Math.max(context[0], right - left),
    (height - 2 * padding) / Math.max(context[1], bottom - top));
  return { scale, left: (width - (left + right) * scale) / 2, top: (height - (top + bottom) * scale) / 2 };
}

function placeMapImage(frame, { scale, left, top }) {
  const image = frame.querySelector(".map-base");
  image.style.width = `${SEOCHEON_MAP.width * scale}px`;
  image.style.height = `${SEOCHEON_MAP.height * scale}px`;
  image.style.transform = `translate(${left}px, ${top}px)`;
}

function layoutOverviewMap(frame, width, height) {
  const pins = [...frame.querySelectorAll("[data-point]")];
  if (!pins.length) return;
  const points = pins.map((pin) => projectMap(pin.dataset.point.split(",").map(Number)));
  const focused = frame.dataset.overview === "focused";
  const extent = focused ? [440, 350] : [940, 690];
  const view = mapViewFor(points, width, height, false, extent);
  placeMapImage(frame, view);
  for (const [index, pin] of pins.entries()) {
    const [mapX, mapY] = points[index];
    const x = view.left + mapX * view.scale;
    const y = view.top + mapY * view.scale;
    pin.style.left = `${x}px`;
    pin.style.top = `${y}px`;
    pin.classList.toggle("label-left", x > width * .57);
  }
  frame.querySelector(".map-regions").classList.add("is-visible");
}

function drawMapSegment(context, points, color, halo, dotted) {
  context.beginPath();
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.lineJoin = "round";
  context.lineCap = "round";
  context.lineWidth = 7;
  context.strokeStyle = halo;
  context.setLineDash([]);
  context.stroke();
  context.lineWidth = 2.8;
  context.strokeStyle = color;
  context.setLineDash(dotted ? [4, 6] : []);
  context.stroke();
}

function layoutMatchMap(frame, width, height) {
  if (width <= 0 || height <= 0) return;
  if (frame.dataset.overview) {
    layoutOverviewMap(frame, width, height);
    return;
  }
  const route = {
    home: frame.dataset.homeArea, work: frame.dataset.workArea,
    mode: frame.dataset.walk === "true" ? "walk" : "shuttle",
  };
  const points = mapPoints(route);
  const coordinates = points.map((point) => projectMap(point.coord));
  const bends = points.length > 2 && ["market", "south"].includes(route.home)
    ? (MAP_BENDS[route.work] || []).map(projectMap) : [];
  const view = mapViewFor([...coordinates, ...bends], width, height, frame.dataset.view === "region");
  const { scale, left, top } = view;
  placeMapImage(frame, view);

  const toScreen = ([x, y]) => [left + x * scale, top + y * scale];
  const screenPoints = coordinates.map(toScreen);
  for (const [index, point] of points.entries()) {
    const [x, y] = screenPoints[index];
    const pin = frame.querySelector(`.point-${point.kind}`);
    const nearMapControl = y < 66 && x > width * .44;
    pin.style.left = `${x}px`;
    pin.style.top = `${y}px`;
    pin.classList.toggle("label-left", nearMapControl || x > width * .58 || (point.kind === "pickup" && x > 86));
    pin.classList.toggle("label-below", point.kind === "work" || (point.kind === "pickup" && y < height * .75));
  }

  const canvas = frame.querySelector("canvas");
  const pixels = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixels);
  canvas.height = Math.round(height * pixels);
  const context = canvas.getContext("2d");
  if (context) {
    context.scale(pixels, pixels);
    const style = getComputedStyle(frame);
    const status = frame.closest("[data-match-status]").dataset.matchStatus;
    const color = style.getPropertyValue("--route-color").trim();
    const halo = style.getPropertyValue("--route-halo").trim();
    if (screenPoints.length > 2) {
      drawMapSegment(context, screenPoints.slice(0, 2), color, halo, true);
      drawMapSegment(context, [screenPoints[1], ...bends.map(toScreen), screenPoints[2]], color, halo, status === "pending");
    } else drawMapSegment(context, screenPoints, color, halo, true);
  }
  frame.querySelector(".map-pins").classList.add("is-visible");
}

const matchMapObserver = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
  for (const { target, contentRect } of entries) layoutMatchMap(target, contentRect.width, contentRect.height);
}) : null;
let firstMapPaint;

function connectMatchMaps() {
  matchMapObserver?.disconnect();
  clearTimeout(firstMapPaint);
  const frames = [...document.querySelectorAll("[data-map-frame]")];
  if (!frames.length) return;
  for (const frame of frames) matchMapObserver?.observe(frame);
  firstMapPaint = setTimeout(() => {
    const measurements = frames.filter((frame) => frame.isConnected
      && !frame.querySelector(".map-regions.is-visible, .map-pins.is-visible"))
      .map((frame) => ({ frame, width: frame.clientWidth, height: frame.clientHeight }));
    for (const { frame, width, height } of measurements) layoutMatchMap(frame, width, height);
  }, 80);
}

function toggleMatchMapView(button) {
  const frame = button.closest("[data-map-frame]");
  const expanded = frame.dataset.view !== "region";
  frame.dataset.view = expanded ? "region" : "route";
  button.setAttribute("aria-pressed", String(expanded));
  layoutMatchMap(frame, frame.clientWidth, frame.clientHeight);
}

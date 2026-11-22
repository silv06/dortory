const WORK_AREAS = {
  janghang: { ko: "장항산단", vi: "Khu công nghiệp Janghang" },
  jongcheon: { ko: "종천농공단지", vi: "Khu công nghiệp Jongcheon" },
  seomyeon: { ko: "서면 수산 현장", vi: "Cơ sở thủy sản Seomyeon" },
  hwayang: { ko: "화양 농업 현장", vi: "Nơi làm việc tại Hwayang" },
};

const HOUSING_AREAS = {
  market: { ko: "서천읍", vi: "Thị trấn Seocheon" },
  south: { ko: "서천읍 남부", vi: "Phía nam thị trấn Seocheon" },
  seomyeon: { ko: "서면", vi: "Seomyeon" },
  hwayang: { ko: "화양면", vi: "Hwayang" },
  janghang: { ko: "장항읍", vi: "Janghang" },
  jongcheon: { ko: "종천면", vi: "Jongcheon" },
  maseo: { ko: "마서면", vi: "Maseo" },
  biin: { ko: "비인면", vi: "Biin" },
  munsan: { ko: "문산면", vi: "Munsan" },
  hansan: { ko: "한산면", vi: "Hansan" },
  gisan: { ko: "기산면", vi: "Gisan" },
  sicho: { ko: "시초면", vi: "Sicho" },
  pangyo: { ko: "판교면", vi: "Pangyo" },
  masan: { ko: "마산면", vi: "Masan" },
};

const HOUSING_DISTRICTS = {
  market: "서천읍", south: "서천읍", seomyeon: "서면", hwayang: "화양면", janghang: "장항읍",
  jongcheon: "종천면", maseo: "마서면", biin: "비인면", munsan: "문산면",
  hansan: "한산면", gisan: "기산면", sicho: "시초면", pangyo: "판교면", masan: "마산면",
};

const STAGES = {
  received: { ko: "신규 상담", vi: "Đã nhận yêu cầu", next: "희망 조건 및 근무시간 확인" },
  waiting: { ko: "매칭 대기", vi: "Đang tìm phương án", next: "주택·귀가 조건 연결 확인" },
  offered: { ko: "주거 제안", vi: "Đã có đề xuất", next: "주택·통근 조합 선택" },
  reviewing: { ko: "AI 검토", vi: "Đang kiểm tra phương án", next: "AI 도토리 안내 확인" },
  preparing: { ko: "입주 서류 준비", vi: "Đang chuẩn bị hồ sơ", next: "서식과 준비 항목 검토" },
  visitReady: { ko: "방문 접수 대기", vi: "Có thể đăng ký lịch hẹn", next: "현장 방문 일정 접수" },
  visit: { ko: "방문 요청", vi: "Đã yêu cầu xem nhà", next: "방문·계약 내용 확인" },
  docs: { ko: "입주 서류", vi: "Hồ sơ vào ở", next: "제출용 초안 및 누락 항목 확인" },
  submitted: { ko: "제출 결과 기록", vi: "Đã ghi nhận kết quả", next: "입주 여부 확인" },
  complete: { ko: "입주 확인", vi: "Đã xác nhận vào ở", next: "상담 완료" },
};

const DOC_ITEMS = {
  contract: { ko: "체류지 증빙 확인", vi: "Xác nhận giấy tờ chứng minh nơi ở" },
  occupancy: { ko: "입주 정보 확인", vi: "Xác nhận thông tin vào ở" },
};

const CASE_STEPS = {
  info: "상담 정보", compare: "주택·통근 비교", ai: "AI 도토리", docs: "입주 서류", visit: "현장 방문 접수",
};
const CASE_STEP_BY_STAGE = {
  received: "info", waiting: "compare", offered: "compare", reviewing: "ai", preparing: "docs",
  visitReady: "visit", visit: "visit", docs: "visit", submitted: "visit", complete: "visit",
};
const VISIT_SLOTS = {
  morning: { ko: "오전", vi: "Buổi sáng" },
  afternoon: { ko: "오후", vi: "Buổi chiều" },
  evening: { ko: "퇴근 후", vi: "Sau ca làm" },
};

function currentCaseStep(record) {
  return CASE_STEP_BY_STAGE[record.stage] || "info";
}

function caseStepUnlocked(record, step) {
  const steps = Object.keys(CASE_STEPS);
  return Object.hasOwn(CASE_STEPS, step) && steps.indexOf(step) <= steps.indexOf(currentCaseStep(record));
}

function canChooseHousing(record) {
  return ["waiting", "offered", "reviewing"].includes(record.stage);
}

function canEditCaseDocuments(record) {
  return ["preparing", "docs"].includes(record.stage);
}

const AFTERCARE_TYPES = {
  housing: { ko: "주거·수리", vi: "Nhà ở và sửa chữa" },
  commute: { ko: "출퇴근 변경", vi: "Thay đổi việc đi lại" },
  papers: { ko: "입주 서류", vi: "Giấy tờ vào ở" },
  other: { ko: "기타", vi: "Khác" },
};

const AFTERCARE_STATES = {
  received: { ko: "접수", vi: "Đã tiếp nhận" },
  working: { ko: "처리 중", vi: "Đang xử lý" },
  resolved: { ko: "처리 완료", vi: "Đã xử lý" },
};

function caseCanUseAftercare(record) {
  return Boolean(record.homeId) && ["docs", "submitted", "complete"].includes(record.stage);
}

function openAftercareCount(record) {
  return (record.aftercare ?? []).filter((ticket) => ticket.status !== "resolved").length;
}

function emptyWorkspace() {
  return { nextCase: 31, cases: [], homes: [], transits: [] };
}

function newDocuments() {
  return { requested: [], supplied: [], checked: [], sourceText: "", draft: null, result: "" };
}

function newCase(id, fields) {
  return {
    id, stage: "received", assigned: "주거상담 담당", due: "", offers: [], homeId: "",
    docs: newDocuments(), history: [{ kind: "created", at: new Date().toISOString() }], ...fields,
  };
}

function caseAccessCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function isWalkingRoute(route) {
  return route.mode === "walk";
}

function timesForShift(workFrom, workTo) {
  const minutes = (time) => {
    const [hours, min] = time.split(":").map(Number);
    return hours * 60 + min;
  };
  const start = minutes(workFrom);
  const end = minutes(workTo);
  return {
    delayBefore: (time) => (start - minutes(time) + 1440) % 1440,
    delayAfter: (time) => (minutes(time) - end + 1440) % 1440,
  };
}

const MATCHING_DEMO_HOMES = [
  {
    area: "janghang", name: "장항읍 산단 인근 소형 주택", deposit: 2000000, rent: 330000, bills: 40000,
    trip: {
      name: "장항산단까지 도보", mode: "walk", cost: 0, outbound: "08:05", arrival: "08:23",
      inbound: "17:35", walk: 18, rideHome: 18, transfers: 0,
    },
  },
  {
    area: "maseo", name: "마서면 다가구 주택", deposit: 3000000, rent: 300000, bills: 45000,
    trip: {
      name: "사업장 차량", mode: "shuttle", cost: 20000, outbound: "07:50", arrival: "08:15",
      inbound: "17:45", walk: 5, rideHome: 28, transfers: 0,
    },
  },
  {
    area: "market", name: "서천읍 생활권 소형 주택", deposit: 2000000, rent: 270000, bills: 45000,
    trip: {
      name: "버스 연계", mode: "bus", cost: 65000, outbound: "07:36", arrival: "08:17",
      inbound: "18:00", walk: 7, rideHome: 40, transfers: 1,
    },
  },
];

function matchingDemoResources(record) {
  const homes = [];
  const transits = [];
  for (const [index, { trip, ...home }] of MATCHING_DEMO_HOMES.entries()) {
    const id = `${record.id}-H${index + 1}`;
    homes.push({
      ...home, id, address: `서천군 ${HOUSING_DISTRICTS[home.area]} (시연용 주소)`, origin: "demo",
      ready: true, from: record.moveIn, until: record.moveOut, places: 2,
    });
    transits.push({
      ...trip, id: `${record.id}-T${index + 1}`, homeId: id, home: home.area, work: "janghang",
      ready: true, seats: 2, owner: "시연용 운행 가정",
    });
  }
  return { homes, transits };
}

function candidateOptions(record, data) {
  const shift = timesForShift(record.workFrom, record.workTo);
  const { homes, transits } = record.channel === "demo" ? matchingDemoResources(record) : data;
  return homes.flatMap((home) => {
    if (home.origin === "public") {
      return [{ home, route: null, monthly: null, returnMinutes: null, reasons: ["public"], eligible: false }];
    }
    const connected = transits.filter((route) => route.work === record.area
      && (route.homeId ? route.homeId === home.id : route.home === home.area));
    const matchingShift = connected.filter((route) => route.arrival && shift.delayBefore(route.arrival) <= 90);
    const routes = matchingShift.length ? matchingShift : connected;
    const reserved = data.cases.some((item) => item.id !== record.id && item.homeId === home.id
      && ["docs", "submitted", "complete"].includes(item.stage)
      && item.moveIn <= record.moveOut && record.moveIn <= item.moveOut);
    const homeChecks = [
      [!home.ready || !home.address, "home"],
      [!home.from || !home.until || record.moveIn < home.from || record.moveOut > home.until, "dates"],
      [!Number.isInteger(home.places) || home.places < record.people, "space"],
      [reserved, "reserved"],
    ];
    return (routes.length ? routes : [null]).map((route) => {
      const knownCosts = [home.deposit, home.rent, home.bills, ...(route ? [route.cost] : [])].every((cost) => Number.isSafeInteger(cost) && cost >= 0);
      const monthly = knownCosts ? home.rent + home.bills + (route?.cost ?? 0) : null;
      const checks = [...homeChecks, [!knownCosts, "cost"], [monthly !== null && monthly > record.budget, "budget"]];
      if (!route) checks.push([true, "route"]);
      else {
        checks.push(
          [route.homeId !== home.id, "link"],
          [!route.inbound, "return"],
          [!route.ready && Boolean(route.inbound), "verify"],
          [!route.arrival || shift.delayBefore(route.arrival) > 90
            || (route.inbound && shift.delayAfter(route.inbound) > 90), "shift"],
          [route.seats < record.people, "seats"],
        );
      }
      const reasons = checks.filter(([show]) => show).map(([, reason]) => reason);
      const returnMinutes = route?.ready && route.inbound && shift.delayAfter(route.inbound) <= 90 && Number.isInteger(route.rideHome)
        ? shift.delayAfter(route.inbound) + route.rideHome
        : null;
      return { home, route, monthly, returnMinutes, reasons, eligible: reasons.length === 0 };
    });
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || Number(Boolean(b.route)) - Number(Boolean(a.route)) || (a.monthly ?? Infinity) - (b.monthly ?? Infinity));
}

function eligiblePlacement(record, data, homeId = record.homeId, transitId = record.transitId) {
  if (!homeId || !transitId) return undefined;
  return candidateOptions(record, data).find(({ home, route, eligible }) =>
    eligible && home.id === homeId && route?.id === transitId);
}

function housingSnapshot(option) {
  return {
    homeId: option.home.id,
    transitId: option.route.id,
    home: { ...option.home },
    route: { ...option.route },
    monthly: option.monthly,
  };
}

function latestProposal(offer, data) {
  if (offer.home && offer.route) return offer;
  const home = data.homes.find((item) => item.id === offer.homeId);
  const route = data.transits.find((item) => item.id === offer.transitId);
  return home && route ? housingSnapshot({ home, route, monthly: home.rent + home.bills + route.cost }) : null;
}

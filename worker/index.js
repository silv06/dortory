const GREEN_URL = "https://www.greendaero.go.kr/svc/rfph/cpif/getVacantHomePagingList.do";
const GREEN_LIST = "https://www.greendaero.go.kr/svc/rfph/cpif/front/vacantlist.do";
const TYPES = { "01": "매매", "02": "전세", "03": "월세", "04": "연세" };
const SOURCE_TTL = 6 * 60 * 60 * 1000;
const MAX_WORKSPACE_BYTES = 1_000_000;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function nearbyArea(address) {
  return address.match(/서천군\s+(\S+[읍면])\s/)?.[1] ?? "";
}

function publicListings(rows) {
  return rows.flatMap((row) => {
    if (!Number.isInteger(row.vacantSn) || typeof row.pstTtlNm !== "string" || typeof row.addr !== "string"
      || !row.addr.startsWith("충청남도 서천군 ") || !Object.hasOwn(TYPES, row.estateDlingTypeCd)) return [];
    const address = row.addr.trim();
    return [{
      id: `green-${row.vacantSn}`, name: row.pstTtlNm.slice(0, 120),
      address: address.replace(/\d/g, "*"), region: nearbyArea(address), type: TYPES[row.estateDlingTypeCd],
      date: /^\d{4}-\d{2}-\d{2}$/.test(row.lastMdfcnDt) ? row.lastMdfcnDt : "",
      source: `https://www.greendaero.go.kr/svc/rfph/cpif/front/vacantdetail.do?vacantSn=${row.vacantSn}`,
    }];
  });
}

function cachedCatalog(contents, fetchedAt, mode) {
  return { ...contents, date: new Date(fetchedAt).toISOString(), mode };
}

async function fetchGreen(db, cache) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const url = new URL(GREEN_URL);
    url.search = new URLSearchParams({
      page: "1", itemsPerPage: "50", ctpvCd: "6440000", sggCd: "4580000",
      completedYn: "N", estateDlingTypeCd: "", searchText: "",
    });
    const response = await fetch(url.href, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      redirect: "manual", signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const total = Number(payload.totalItems);
    if (!Array.isArray(payload.list) || !Number.isSafeInteger(total)
      || total < 0 || payload.list.length > 50) throw new Error("Unexpected source fields");
    const listings = publicListings(payload.list);
    if (payload.list.length && !listings.length) throw new Error("No recognized source records");
    const contents = { listings, total };
    const fetchedAt = Date.now();
    if (db) {
      await db.prepare(`INSERT INTO dortory_source_cache (source, contents, fetched_at)
        VALUES ('green', ?, ?) ON CONFLICT(source) DO UPDATE SET
        contents=excluded.contents, fetched_at=excluded.fetched_at`)
        .bind(JSON.stringify(contents), fetchedAt).run().catch(() => {});
    }
    return cachedCatalog(contents, fetchedAt, "current");
  } catch (error) {
    const reason = controller.signal.aborted ? "Timeout" : String(error?.message ?? "Unknown error").slice(0, 125);
    console.error("GreenDaero source refresh:", reason);
    if (cache) return cachedCatalog(JSON.parse(cache.contents), cache.fetched_at, "cached");
    return { listings: publicListings(GREEN_SNAPSHOT), total: GREEN_SNAPSHOT.length, date: KNOWLEDGE.as_of, mode: "snapshot" };
  } finally {
    clearTimeout(timer);
  }
}

async function catalog(db) {
  const cached = db && await db.prepare("SELECT contents, fetched_at FROM dortory_source_cache WHERE source='green'")
    .first().catch(() => null);
  const green = cached && Date.now() - cached.fetched_at < SOURCE_TTL
    ? cachedCatalog(JSON.parse(cached.contents), cached.fetched_at, "current")
    : await fetchGreen(db, cached);
  return { apartments: APARTMENTS, apartmentSource: KNOWLEDGE.sources.apartments.url, green: { ...green, source: GREEN_LIST } };
}

const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/đ/g, "d").normalize("NFC");

const searchIntents = [
  [/며칠|언제까지|기한|15일|bao lau|bao nhieu ngay|thoi han|deadline/, ["law36", "gov24"]],
  [/서류|증빙|제출|giay to|ho so|can nop/, ["gov24", "form34vi", "form34", "stay"]],
  [/대리|위임|uy quyen/, ["gov24", "form34vi"]],
  [/체류지|주소.{0,6}변경|신고서|doi (?:dia chi|noi luu tru)|bao cao/, ["gov24", "law36", "form34vi", "form34"]],
  [/숙소\s*제공|기숙사|ky tuc xa|cung cap cho o/, ["stay", "dorm", "gov24"]],
  [/임대차|표준계약|계약서|보증금|hop dong|tien coc/, ["lease-ko", "lease-vi", "gov24"]],
  [/빈집|유휴공간|nha trong/, ["vacant-bank", "vacant-study"]],
  [/아파트|단지|chung cu/, ["apartments"]],
  [/기업|사업장|doanh nghiep/, ["businesses"]],
  [/국적|quoc tich/, ["nationality"]],
  [/비자|체류자격|visa/, ["visa"]],
  [/등록외국인|외국인.{0,7}(?:인원|인구|몇 명)|nguoi nuoc ngoai/, ["regions", "monthly", "visa", "nationality"]],
  [/버스|운행|귀가편|xe buyt/, ["transit"]],
  [/실거래|전월세 가격|gia thue/, ["rent"]],
  [/건축물|주거 용도|용도변경/, ["building", "change-use"]],
];
const searchRows = KNOWLEDGE.chunks.map((chunk) => ({
  chunk, text: normalize(`${chunk.title} ${chunk.tags} ${chunk.text} ${chunk.vi ?? ""}`),
}));

function retrieve(question, language) {
  const query = normalize(question).slice(0, 650);
  const sources = searchIntents.filter(([intent]) => intent.test(query)).flatMap(([, ids]) => ids);
  const area = query.match(/(서천읍|장항읍|마서면|종천면|서면|화양면|비인면|문산면|한산면|기산면|시초면|판교면|마산면)/)?.[1];
  const terms = [...new Set(query.match(/[a-z]{3,}|[가-힣]{2,}|20\d{2}/g) ?? [])]
    .filter((term) => !["서천군", "알려주세요", "알려줘", "정보", "어떻게", "무엇인가요", "cua", "cho", "toi", "the", "nha", "nguoi"].includes(term));
  const ranked = searchRows.map(({ chunk, text }) => {
    const matches = terms.reduce((total, term) => total + (text.includes(term) ? 2 : 0), 0);
    const intent = sources.indexOf(chunk.source);
    const region = area ? (text.includes(area) ? 12 : -8) : 0;
    const year = /^monthly-20/.test(chunk.id) ? Number(chunk.id.slice(8)) / 1e6 : 0;
    let score = matches + region + (intent < 0 ? 0 : 9 - Math.min(intent, 8)) + year;
    if (chunk.id === "law36-deadline" && searchIntents[0][0].test(query)) score += 12;
    if (chunk.id === "gov24-proof" && searchIntents[1][0].test(query)) score += 6;
    return { chunk, score };
  }).filter((result) => result.score >= 5).sort((a, b) => b.score - a.score);
  const perSource = new Map();
  return ranked.filter(({ chunk }) => {
    const count = (perSource.get(chunk.source) ?? 0) + 1;
    perSource.set(chunk.source, count);
    return count <= 2;
  }).slice(0, 5).map(({ chunk }) => {
    const { title, publisher, date, url, kind } = KNOWLEDGE.sources[chunk.source];
    return { title, publisher, date, url, kind, locator: chunk.locator, text: language === "vi" ? chunk.vi || chunk.text : chunk.text };
  });
}

async function searchPublicKnowledge(question, language, db) {
  const evidence = retrieve(question, language);
  if (!/빈집|nha trong/.test(normalize(question)) || !/현재|지금|매물|매매|월세|전세|몇\s*건|hien tai|bao nhieu/.test(normalize(question))) return evidence;
  const { green } = await catalog(db);
  const types = Object.values(TYPES).map((type) => green.listings.filter((item) => item.type === type).length);
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date(green.date));
  const observed = green.listings.length === green.total ? "" : `조회한 ${green.listings.length}건 기준으로 `;
  const text = language === "vi"
    ? `Ngày ${date}, danh sách GreenDaero tại Seocheon có ${green.total} mục. Trong ${green.listings.length} mục đã đọc có ${types[0]} mục bán, ${types[1]} mục jeonse, ${types[2]} mục cho thuê hằng tháng và ${types[3]} mục cho thuê hằng năm. Hãy kiểm tra tình trạng giao dịch trên trang gốc.`
    : `${date} 기준 그린대로의 서천군 목록은 ${green.total}건입니다. ${observed}매매 ${types[0]}건, 전세 ${types[1]}건, 월세 ${types[2]}건, 연세 ${types[3]}건입니다. 거래 가능 여부는 원천 게시물을 확인하세요.`;
  return [{
    title: "그린대로 서천군 빈집 거래 목록", publisher: "그린대로", date, url: green.source,
    kind: "data", locator: green.mode === "current" ? "공개 목록 조회" : "마지막 확인 자료", text,
  }, ...evidence.filter((item) => item.url !== GREEN_LIST)].slice(0, 5);
}

async function appRequest(request, env) {
    const path = new URL(request.url).pathname;
    try {
      if (path === "/api/vercel/relay") return await vercelRelay(request, env);
      if (path === "/api/admin/logs") return await adminLogs(request, env);
      if (path === "/api/admin/mail") return await adminMail(request, env);
      if (path === "/api/admin/session") return await adminSession(request, env);
      if (path === "/api/workspace") return await adminWorkspace(request, env);
      if (path === "/api/user/cases") return await userCases(request, env);
      if (path === "/api/rag/status" && request.method === "GET") {
        return json({ as_of: KNOWLEDGE.as_of, sources: Object.keys(KNOWLEDGE.sources).length, units: searchRows.length, ...KNOWLEDGE.counts });
      }
      if (path === "/api/rag/query" && request.method === "POST") {
        const { question } = await request.json().catch(() => ({})) ?? {};
        if (typeof question !== "string" || question.trim().length < 2 || question.length > 650) {
          return json({ error: "두 글자 이상 질문을 입력해 주세요." }, 400);
        }
        const evidence = await searchPublicKnowledge(question, "ko", env.DB);
        return json({ evidence, answer: evidence[0]?.text ?? "일치하는 공식 근거를 찾지 못했습니다. 서식 이름이나 읍·면을 넣어 검색해 주세요." });
      }
    } catch {
      await recordAudit(env, identity(request), "api.error", "", "failed", path.startsWith("/api/") ? path.split("?")[0].slice(0, 70) : "");
      return json({ error: "사이트 자료를 불러오는 중 문제가 생겼습니다. 다시 시도해 주세요." }, 503);
    }
    const file = SITE_FILES[path === "/" ? "/index.html" : path];
    if (!file || !["GET", "HEAD"].includes(request.method)) return new Response("찾을 수 없습니다.", { status: 404 });
    return new Response(request.method === "HEAD" ? null : Uint8Array.from(atob(file[1]), (char) => char.charCodeAt(0)), {
      headers: {
        "Content-Type": file[0], "Content-Length": String(file[1].length / 4 * 3 - (file[1].endsWith("==") ? 2 : Number(file[1].endsWith("=")))),
        "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff",
      },
    });
}

export default { fetch: appRequest };

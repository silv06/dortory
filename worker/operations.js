const OPERATIONS_KEY = "dortory-site-operations";
const ADMIN_COOKIE = "__Host-dortory_admin";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const LH_SUMMER = "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020395&uppAisTpCd=06";
const LH_MARCH = "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=19803";
const LH_NOTICES = Object.fromEntries([
  ...["apt-16", "apt-17", "apt-19"].map((id) => [id, { url: LH_SUMMER, date: "2026-07-15" }]),
  ["apt-26", { url: LH_MARCH, date: "2026-03-23" }],
]);
const LEGACY_HOME_NAMES = ["시장권 주택 A", "시장권 주택 B", "서면 단기 숙소 C", "시장권 가족 주택 D", "화양권 주택 C"];
const LEGACY_TRANSIT_NAMES = ["시장권–장항 주간", "시장권 남쪽–장항 주간", "시장권–종천 주간", "서면 일터 도보",
  "시장권–장항 야간 A", "시장권 남쪽–장항 야간 B", "화양권–장항 야간 C"];

function identity(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return id && email ? { id, email } : null;
}

function isDesignatedAdmin(user, env) {
  return Boolean(user && env.DORTORY_ADMIN_EMAIL && user.email === env.DORTORY_ADMIN_EMAIL.trim().toLowerCase());
}

function sameOriginJson(request) {
  return request.headers.get("Origin") === new URL(request.url).origin
    && request.headers.get("Content-Type")?.split(";")[0].trim() === "application/json";
}

function adminToken(request) {
  const part = request.headers.get("Cookie")?.split(";").map((value) => value.trim())
    .find((value) => value.startsWith(ADMIN_COOKIE + "="));
  const token = part?.slice(ADMIN_COOKIE.length + 1);
  return /^[a-f\d]{64}$/.test(token ?? "") ? token : null;
}

function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenDigest(token) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

function adminCookie(token, seconds) {
  return `${ADMIN_COOKIE}=${token}; Max-Age=${seconds}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function cookieResponse(body, token, seconds) {
  const response = json(body);
  response.headers.set("Set-Cookie", adminCookie(token, seconds));
  return response;
}

async function activeAdmin(request, env, user = identity(request)) {
  if (!isDesignatedAdmin(user, env) || !env.DB) return false;
  const token = adminToken(request);
  if (!token) return false;
  const row = await env.DB.prepare("SELECT token_hash FROM dortory_admin_sessions WHERE token_hash=? AND user_id=? AND expires_at>?")
    .bind(await tokenDigest(token), user.id, Date.now()).first();
  return Boolean(row);
}

function legacyResource(item, names) {
  return item.origin === "demo" || (!item.origin && names.includes(item.name) && !item.address && !item.sourceId);
}

function legacyCase(item) {
  return /^SC-02[6-9]$|^SC-030$/.test(item.id)
    && item.history?.[0]?.at === "2026-11-17T10:00:00+09:00";
}

async function readOperations(db) {
  const row = await db.prepare("SELECT revision, contents FROM dortory_workspace WHERE user_id=?").bind(OPERATIONS_KEY).first();
  return row ? { revision: row.revision, database: JSON.parse(row.contents) } : null;
}

async function initializeOperations(db, ownerId) {
  if (await readOperations(db)) return;
  const row = await db.prepare("SELECT contents FROM dortory_workspace WHERE user_id=?").bind(ownerId).first();
  const source = row ? JSON.parse(row.contents) : emptyWorkspace();
  const homes = source.homes.filter((home) => !legacyResource(home, LEGACY_HOME_NAMES) && home.origin !== "public")
    .map((home) => ({ ...home, origin: "registered" }));
  const transits = source.transits.filter((route) => !legacyResource(route, LEGACY_TRANSIT_NAMES))
    .map((route) => ({ ...route, origin: "registered" }));
  const demoHomes = new Set(source.homes.filter((home) => legacyResource(home, LEGACY_HOME_NAMES)).map((home) => home.id));
  const demoTrips = new Set(source.transits.filter((trip) => legacyResource(trip, LEGACY_TRANSIT_NAMES)).map((trip) => trip.id));
  const cases = source.cases.filter((item) => !legacyCase(item)).map((item) => {
    const offers = item.offers.filter((offer) => !demoHomes.has(offer.homeId) && !demoTrips.has(offer.transitId));
    const selectedDemo = demoHomes.has(item.homeId) || demoTrips.has(item.transitId);
    const reset = (item.stage === "offered" && !offers.length) || (item.stage === "visit" && selectedDemo);
    const legacyFields = item.channel === "mobile" && !item.accountId ? { accountId: ownerId } : {};
    return { ...item, ...legacyFields, offers, ...(reset ? { stage: "waiting", homeId: "", transitId: "", visitDate: "", visitTime: "" } : {}) };
  });
  const database = { nextCase: Math.max(source.nextCase, 31), homes, transits, cases };
  await db.prepare("INSERT INTO dortory_workspace (user_id, revision, contents, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING")
    .bind(OPERATIONS_KEY, JSON.stringify(database), Date.now()).run();
}

async function initializeRegistry(db) {
  const apartmentDate = Date.parse(KNOWLEDGE.sources.apartments.date);
  const apartmentRows = JSON.stringify({ apartments: APARTMENTS, apartmentSource: KNOWLEDGE.sources.apartments.url });
  const greenRows = JSON.stringify({ listings: publicListings(GREEN_SNAPSHOT), total: GREEN_SNAPSHOT.length });
  const upsert = `INSERT INTO dortory_source_cache (source, contents, fetched_at) VALUES (?, ?, ?)
    ON CONFLICT(source) DO UPDATE SET contents=excluded.contents, fetched_at=excluded.fetched_at
    WHERE excluded.fetched_at > dortory_source_cache.fetched_at`;
  await db.batch([
    db.prepare(upsert).bind("apartments", apartmentRows, apartmentDate),
    db.prepare(upsert).bind("green-baseline", greenRows, Date.parse(KNOWLEDGE.as_of)),
  ]);
}

async function prepareAdminSession(env, user) {
  await Promise.all([initializeOperations(env.DB, user.id), initializeRegistry(env.DB)]);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const expires = now + ADMIN_SESSION_SECONDS * 1000;
  const statements = [
    env.DB.prepare("DELETE FROM dortory_admin_sessions WHERE expires_at<=?").bind(now),
    env.DB.prepare("INSERT INTO dortory_admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .bind(await tokenDigest(token), user.id, expires),
    auditStatement(env.DB, user, "admin.login"),
  ];
  return { token, expires, statements };
}

async function adminSession(request, env) {
  const user = identity(request);
  const allowed = isDesignatedAdmin(user, env);
  if (request.method === "GET") {
    return json({ authenticated: Boolean(user), email: user?.email ?? "", allowed, active: await activeAdmin(request, env, user) });
  }
  if (!["POST", "DELETE"].includes(request.method)) return json({ error: "지원하지 않는 요청입니다." }, 405);
  if (!sameOriginJson(request)) return json({ error: "도토리 화면에서 다시 시도해 주세요." }, 403);
  if (!user) return json({ error: "지정된 구글 계정으로 로그인해 주세요." }, 401);
  if (!allowed) {
    await recordAudit(env, user, "admin.login", "", "denied");
    return json({ error: "지정된 관리자 계정만 접근할 수 있습니다." }, 403);
  }
  if (!env.DB) return json({ error: "관리자 세션 저장소를 열 수 없습니다." }, 503);
  const token = adminToken(request);
  if (request.method === "DELETE") {
    if (token) await env.DB.prepare("DELETE FROM dortory_admin_sessions WHERE token_hash=? AND user_id=?")
      .bind(await tokenDigest(token), user.id).run();
    await recordAudit(env, user, "admin.logout");
    return cookieResponse({ active: false }, "", 0);
  }
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "로그인 요청을 확인해 주세요." }, 400);
  if (payload.email !== undefined && normalizeEmail(payload.email).toLowerCase() !== user.email) {
    return json({ error: "지정된 관리자 이메일과 현재 로그인 계정을 확인해 주세요." }, 403);
  }
  const session = await prepareAdminSession(env, user);
  const { statements } = session;
  if (token) statements.push(env.DB.prepare("DELETE FROM dortory_admin_sessions WHERE token_hash=? AND user_id=?")
    .bind(await tokenDigest(token), user.id));
  await env.DB.batch(statements);
  return cookieResponse({ active: true }, session.token, ADMIN_SESSION_SECONDS);
}

function districtKey(region) {
  return Object.keys(HOUSING_DISTRICTS).find((key) => HOUSING_DISTRICTS[key] === region) ?? "market";
}

function addressKey(address) {
  return address && !address.includes("*") ? address.replace(/\s+/g, "").replace(/^충청남도|^충남/, "") : "";
}

async function registrySources(db, refresh) {
  const statement = "SELECT contents, fetched_at FROM dortory_source_cache WHERE source=?";
  const [apartments, live, baseline] = await Promise.all(["apartments", "green", "green-baseline"]
    .map((source) => db.prepare(statement).bind(source).first()));
  if (!apartments || !baseline) throw new Error("Official registry has not been initialized");
  const green = live
    ? cachedCatalog(JSON.parse(live.contents), live.fetched_at, Date.now() - live.fetched_at < SOURCE_TTL ? "current" : "cached")
    : cachedCatalog(JSON.parse(baseline.contents), baseline.fetched_at, "snapshot");
  const refreshed = refresh && green.mode !== "current" ? await fetchGreen(db, live ?? baseline) : green;
  return { ...JSON.parse(apartments.contents), green: { ...refreshed, source: GREEN_LIST } };
}

function housingDirectory(registered, sources) {
  const found = new Set();
  const sourceRows = [
    ...sources.apartments.map((item) => ({
      id: item.id, sourceId: item.id, origin: "public", name: item.name,
      address: item.address, area: districtKey(item.region), ready: false,
      source: { type: "아파트 현황", url: sources.apartmentSource, date: item.date, phone: item.phone, notice: LH_NOTICES[item.id] },
    })),
    ...sources.green.listings.map((item) => ({
      id: item.id, sourceId: item.id, origin: "public", name: item.name,
      address: item.address.replace(/\d/g, "*"), area: districtKey(item.region), ready: false,
      source: { type: item.type, url: item.source || sources.green.source, date: item.date },
    })),
  ];
  const merged = sourceRows.map((row) => {
    const address = addressKey(row.address);
    const checked = registered.find((item) => !found.has(item.id) && (
      item.sourceId === row.id || item.id === row.id || (address && address === addressKey(item.address))));
    if (!checked) return row;
    found.add(checked.id);
    return { ...row, ...checked, origin: "registered", sourceId: row.id, source: row.source };
  });
  return [...registered.filter((row) => !found.has(row.id)), ...merged];
}

function validWorkspacePayload(store) {
  return store && Number.isSafeInteger(store.nextCase) && store.nextCase >= 31
    && ["cases", "homes", "transits"].every((key) => Array.isArray(store[key])
      && store[key].every((item) => item && typeof item.id === "string")
      && new Set(store[key].map((item) => item.id)).size === store[key].length);
}

async function storeOperations(db, revision, database, audit) {
  const contents = JSON.stringify(database);
  if (new TextEncoder().encode(contents).length > MAX_WORKSPACE_BYTES) return 413;
  const update = db.prepare("UPDATE dortory_workspace SET revision=revision+1, contents=?, updated_at=? WHERE user_id=? AND revision=?")
    .bind(contents, Date.now(), OPERATIONS_KEY, revision);
  const result = audit ? (await db.batch([update, auditStatement(db, ...audit, true)]))[0] : await update.run();
  return result.meta.changes ? 200 : 409;
}

async function adminWorkspace(request, env) {
  if (!await activeAdmin(request, env)) return json({ error: "관리자 로그인이 필요합니다." }, 403);
  const db = env.DB;
  if (request.method === "GET") {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const [operations, sources] = await Promise.all([readOperations(db), registrySources(db, refresh)]);
    if (!operations) return json({ error: "운영 대장을 열 수 없습니다." }, 503);
    const { revision, database } = operations;
    return json({
      revision, database: { ...database, homes: housingDirectory(database.homes, sources) },
      availability: { greenDate: sources.green.date, greenMode: sources.green.mode, apartments: sources.apartments.length, green: sources.green.total },
    });
  }
  if (request.method === "POST") return handleAdminCasePost(request, env);
  if (request.method !== "PUT") return json({ error: "지원하지 않는 요청입니다." }, 405);
  if (!sameOriginJson(request)) return json({ error: "도토리 화면에서 다시 시도해 주세요." }, 403);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_WORKSPACE_BYTES) return json({ error: "저장할 기록 크기를 확인해 주세요." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "저장할 데이터 형식을 확인해 주세요." }, 400); }
  if (!Number.isSafeInteger(body?.revision) || !validWorkspacePayload(body.database)) return json({ error: "저장할 대장을 확인해 주세요." }, 400);
  const { cases, homes, transits, nextCase } = body.database;
  const registered = homes.filter((row) => row.origin === "registered");
  const saved = await readOperations(db);
  if (!saved || saved.revision !== body.revision) return json({ error: "다른 요청이 먼저 기록을 변경했습니다." }, 409);
  if (saved.database.nextCase !== nextCase || !preservesCaseWorkflow(saved.database.cases, cases)) {
    return json({ error: "상담 상세 화면에서 각 단계를 순서대로 처리해 주세요." }, 422);
  }
  const database = { cases, homes: registered, transits, nextCase };
  const code = await storeOperations(db, body.revision, database, [identity(request), "workspace.update", "", "success", JSON.stringify({ cases: cases.length, homes: registered.length, transits: transits.length })]);
  return code === 200 ? json({ revision: body.revision + 1 })
    : json({ error: code === 409 ? "다른 요청이 먼저 기록을 변경했습니다." : "기록 크기를 확인해 주세요." }, code);
}

function isoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function application(fields, channel = "mobile") {
  const onsite = channel === "field";
  const contactEmail = normalizeEmail(fields?.contactEmail);
  const contact = onsite ? fields?.contact : "email";
  if (!fields || fields.consent !== "on" || typeof fields.alias !== "string" || typeof fields.notes !== "string"
    || !fields.alias.trim() || fields.alias.trim().length > 30 || fields.notes.length > (onsite ? 280 : 400)
    || !Object.hasOwn(WORK_AREAS, fields.area) || !["ko", "vi"].includes(fields.locale)
    || (onsite ? !["onsite", "message"].includes(contact) : !contactEmail)
    || !isoDate(fields.moveIn) || !isoDate(fields.moveOut)
    || fields.moveIn >= fields.moveOut || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fields.workFrom)
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(fields.workTo) || fields.workFrom === fields.workTo) return null;
  const people = Number(fields.people);
  const budget = Number(fields.budget);
  if (!Number.isInteger(people) || people < 1 || people > 12 || !Number.isInteger(budget) || budget < 1 || budget > 10000000) return null;
  return {
    alias: fields.alias.trim(), notes: fields.notes.trim(), locale: fields.locale, contact,
    ...(!onsite && { contactEmail }),
    area: fields.area, moveIn: fields.moveIn, moveOut: fields.moveOut, workFrom: fields.workFrom, workTo: fields.workTo, people, budget,
  };
}

async function handleAdminCasePost(request, env) {
  if (!sameOriginJson(request)) return json({ error: "도토리 화면에서 다시 시도해 주세요." }, 403);
  const raw = await request.text();
  if (raw.length > 4000) return json({ error: "상담 입력 분량을 확인해 주세요." }, 413);
  let body;
  try { body = JSON.parse(raw); }
  catch { return json({ error: "상담 요청 형식을 확인해 주세요." }, 400); }
  if (body?.action === "start-matching-demo") return registerAdminIntake(body, request, env, true);
  if (body && Object.hasOwn(body, "action")) return runAdminCaseCommand(body, request, env);
  return registerAdminIntake(body, request, env);
}

function matchingDemoProfile() {
  const today = Date.now();
  const dateIn = (days) => new Date(today + days * 86400000).toISOString().slice(0, 10);
  return {
    alias: "장항산단 주간근무 2인", assigned: "매칭 시연", area: "janghang", locale: "ko", people: 2, budget: 450000,
    moveIn: dateIn(21), moveOut: dateIn(201), workFrom: "08:30", workTo: "17:30",
    notes: "월 부담 45만 원 이내, 환승 적은 귀가편과 퇴근 후 빠른 귀가 희망",
  };
}

async function registerAdminIntake(body, request, env, demo = false) {
  const fields = demo ? matchingDemoProfile() : application(body?.fields, "field");
  if (!fields || typeof body.requestId !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(body.requestId)) {
    return json({ error: demo ? "시연 상담을 다시 시작해 주세요." : "현장 상담 입력 항목을 확인해 주세요." }, 400);
  }
  const user = identity(request);
  const requestKey = demo ? "demoRequest" : "fieldRequest";
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await readOperations(env.DB);
    if (!saved) return json({ error: "운영 대장을 열 수 없습니다." }, 503);
    const { database, revision } = saved;
    const duplicate = database.cases.find((item) => item[requestKey] === body.requestId);
    if (duplicate) {
      if (demo || Object.entries(fields).every(([key, value]) => duplicate[key] === value)) return json({ id: duplicate.id });
      return json({ error: `이미 ${duplicate.id}로 등록된 요청입니다. 업무함에서 이 상담을 확인해 주세요.` }, 409);
    }
    const id = demo ? `DEMO-${database.cases.filter((item) => item.channel === "demo").length + 1}`
      : `SC-${String(database.nextCase++).padStart(3, "0")}`;
    const record = newCase(id, {
      ...fields, [requestKey]: body.requestId,
      ...(demo ? { channel: "demo", stage: "waiting" } : { channel: "field", pin: caseAccessCode() }),
    });
    if (demo) record.history.push({ kind: "intakeConfirmed", at: record.history[0].at });
    database.cases.unshift(record);
    const status = await storeOperations(env.DB, revision, database,
      [user, demo ? "case.demo.create" : "case.field.create", id, "success", ""]);
    if (status === 200) return json({ id });
    if (status === 413) return json({ error: "상담 저장 용량을 확인해 주세요." }, 413);
  }
  return json({ error: "상담 기록이 변경됐습니다. 입력을 유지한 상태에서 다시 저장해 주세요." }, 409);
}

function visibleCase(item, database) {
  const proposals = item.offers.map((offer) => latestProposal(offer, database)).filter(Boolean).map(({ homeId, transitId, monthly, home, route }) => {
    const { id, name, nameVi, address, area, rent, bills, deposit, from } = home;
    const { home: origin, work, outbound, arrival, inbound, walk, rideHome, transfers, cost, mode } = route;
    return { homeId, transitId, monthly, home: { id, name, nameVi, address, area, rent, bills, deposit, from },
      route: { id: transitId, home: origin, work, outbound, arrival, inbound, walk, rideHome, transfers, cost, mode } };
  });
  return {
    id: item.id, alias: item.alias, locale: item.locale, area: item.area,
    stage: item.stage, homeId: item.homeId, transitId: item.transitId, visitDate: item.visitDate, visitTime: item.visitTime,
    submittedAt: item.history.find((event) => event.kind === "created")?.at,
    contactEmail: item.contactEmail,
    aftercare: (item.aftercare ?? []).map(({ id, category, message, status, createdAt, updates }) =>
      ({ id, category, message, status, createdAt, updates })),
    offers: proposals, docs: { requested: item.docs.requested, acknowledged: Boolean(item.docs.acknowledged) },
  };
}

function submitAftercare(item, body) {
  if (!caseCanUseAftercare(item)) return { code: 409, error: "매칭이 확인되면 사후관리 요청을 보낼 수 있습니다." };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!Object.hasOwn(AFTERCARE_TYPES, body.category) || !message || message.length > 800
    || typeof body.requestId !== "string" || !/^[\da-f-]{36}$/.test(body.requestId)) {
    return { code: 400, error: "사후관리 유형과 내용을 확인해 주세요." };
  }
  item.aftercare ??= [];
  if (item.aftercare.some((ticket) => ticket.id === body.requestId)) return { item, unchanged: true };
  const createdAt = new Date().toISOString();
  item.aftercare.unshift({ id: body.requestId, category: body.category, message, status: "received", createdAt, updates: [] });
  item.history.push({ kind: "aftercare", detail: AFTERCARE_TYPES[body.category].ko, at: createdAt });
  return { item };
}

function applyCaseRequest(body, database, user) {
  if (body.action === "create") {
    const submitted = application(body.fields);
    if (!submitted) return { code: 400, error: "신청 항목을 확인해 주세요." };
    const duplicate = database.cases.find((entry) => entry.accountId === user.id && entry.clientRequest === body.requestId);
    if (duplicate) return { item: duplicate, unchanged: true };
    if (!/^[\da-f-]{36}$/.test(body.requestId ?? "")) return { code: 400, error: "신청을 다시 열어 주세요." };
    const item = newCase(`SC-${String(database.nextCase++).padStart(3, "0")}`, {
      ...submitted, channel: "mobile", accountId: user.id, clientRequest: body.requestId,
    });
    database.cases.unshift(item);
    return { item };
  }
  const item = database.cases.find((entry) => entry.id === body.id);
  const unavailable = { code: 404, error: "이 계정의 상담을 찾을 수 없습니다. 상담번호와 연결 코드를 확인해 주세요." };
  if (!item || item.channel === "demo") return unavailable;
  if (body.action === "claim") {
    if (item.accountId === user.id) return { item, unchanged: true };
    if (item.accountId || !/^[A-F\d]{16}$/.test(body.pin ?? "") || item.pin !== body.pin) return unavailable;
    item.accountId = user.id;
    item.pin = "";
    return { item };
  }
  if (item.accountId !== user.id) return unavailable;
  if (body.action === "aftercare") return submitAftercare(item, body);
  if (body.action === "receipt") return { item, unchanged: true };
  if (body.action === "visit") {
    if (item.homeId !== body.homeId || item.transitId !== body.transitId) {
      return { code: 409, error: "상담에서 선택된 주택과 통근편을 확인해 주세요." };
    }
    if (item.stage === "visit" && item.visitDate === body.date && item.visitTime === body.slot) return { item, unchanged: true };
    const error = registerVisit(item, database, body.date, body.slot);
    if (error) return { code: 409, error };
    return { item };
  }
  if (body.action === "acknowledge" && canEditCaseDocuments(item) && item.docs.requested.length) {
    if (item.docs.acknowledged) return { item, unchanged: true };
    item.docs.acknowledged = true;
    item.history.push({ kind: "acknowledged", at: new Date().toISOString() });
    return { item };
  }
  return { code: 409, error: "현재 상담 단계에서 처리할 수 없는 요청입니다." };
}

async function userCases(request, env) {
  const user = identity(request);
  if (!user) return json({ error: "구글 계정으로 로그인해 주세요." }, 401);
  if (!env.DB) return json({ error: "상담 저장소를 열 수 없습니다." }, 503);
  if (request.method === "GET") {
    env = await receiptRuntime(env);
    const saved = await readOperations(env.DB);
    const owned = saved?.database.cases.filter((item) => item.channel !== "demo" && item.accountId === user.id) ?? [];
    const rows = owned.some((item) => item.contactEmail)
      ? (await env.DB.prepare(`SELECT case_id, state, attempted_at, first_attempt_at FROM dortory_receipts WHERE account_id=?`)
        .bind(user.id).all()).results
      : [];
    const receipts = new Map(rows.map((row) => [row.case_id, row]));
    const cases = owned.map((item) => ({ ...visibleCase(item, saved.database), receipt: receiptView(item, receipts.get(item.id), env) }));
    return json({ cases });
  }
  if (request.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405);
  if (!sameOriginJson(request)) return json({ error: "도토리 화면에서 다시 시도해 주세요." }, 403);
  const raw = await request.text();
  if (raw.length > 4000) return json({ error: "상담 입력 분량을 확인해 주세요." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: "상담 입력을 확인해 주세요." }, 400); }
  if (!body || typeof body.action !== "string") return json({ error: "지원하지 않는 요청입니다." }, 400);
  for (let attempt = 0; attempt < 3; attempt++) {
    const saved = await readOperations(env.DB);
    if (!saved) return json({ error: "관리자가 대장을 처음 열고 나면 상담을 접수할 수 있습니다." }, 503);
    const result = applyCaseRequest(body, saved.database, user);
    if (result.error) return json({ error: result.error }, result.code);
    const status = result.unchanged ? 200 : await storeOperations(env.DB, saved.revision, saved.database, [user, "case." + body.action, result.item.id, "success", ""]);
    if (status === 200) {
      const receipt = await receiptForResponse(result.item, env, body.action === "create" || body.action === "receipt");
      return json({ record: { ...visibleCase(result.item, saved.database), receipt } });
    }
    if (status === 413) return json({ error: "상담 저장 용량을 확인해 주세요." }, 413);
  }
  return json({ error: "상담이 변경됐습니다. 화면을 새로 열어 다시 시도해 주세요." }, 409);
}

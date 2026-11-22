const RECEIPT_API = "https://api.resend.com/emails";
const RECEIPT_PORTAL = "https://finder-seocheon-housing.boldchord514.chatgpt.site/#/my-case";
const RECEIPT_LEASE_MS = 20000;
const RECEIPT_REPLAY_MS = 23 * 60 * 60 * 1000;

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim();
  const parts = email.split("@");
  if (email.length > 254 || parts.length !== 2 || parts[0].length > 64
    || !/^[\w.!#$%&'*+/=?^{}|~\x60-]+$/.test(parts[0]) || /(^\.|\.$|\.\.)/.test(parts[0])
    || !/^(?=.{1,253}$)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(parts[1])) return "";
  return parts[0] + "@" + parts[1].toLowerCase();
}

function mailIsConfigured(env) {
  return Boolean(env.GMAIL_SENDER || (env.RESEND_API_KEY?.trim() && normalizeEmail(env.DORTORY_MAIL_FROM)));
}

function receiptView(item, job, env) {
  if (!item.contactEmail) return null;
  if (job?.state === "sent") return { state: "sent", retryable: false };
  if (!mailIsConfigured(env)) return { state: "unavailable", retryable: false };
  if (!job) return { state: "queued", retryable: true };
  const now = Date.now();
  const unknown = ["sending", "unknown"].includes(job.state);
  const stale = now - job.attempted_at >= RECEIPT_LEASE_MS;
  const safelyRetryable = !unknown || (!env.GMAIL_SENDER && now - job.first_attempt_at < RECEIPT_REPLAY_MS);
  return { state: job.state === "sending" && stale ? "unknown" : job.state, retryable: stale && safelyRetryable };
}

async function findReceipt(db, item) {
  return db.prepare(`SELECT state, attempted_at, first_attempt_at
    FROM dortory_receipts WHERE case_id=? AND account_id=?`).bind(item.id, item.accountId).first();
}

function receiptMessage(item, from, env) {
  const vi = item.locale === "vi";
  const at = item.history.find((event) => event.kind === "created")?.at;
  const date = at && new Intl.DateTimeFormat(vi ? "vi-VN" : "ko-KR", {
    timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(at));
  return {
    from: `도토리 <${from}>`,
    to: [item.contactEmail],
    subject: vi ? `[Dortory] Đã nhận yêu cầu tư vấn nhà ở (${item.id})` : `[도토리] 주거 상담 신청 접수 (${item.id})`,
    text: (vi ? [
      "Dortory đã nhận yêu cầu tư vấn nhà ở của bạn.",
      `Mã hồ sơ: ${item.id}`, date && `Thời gian tiếp nhận (giờ Hàn Quốc): ${date}`,
      "Nhân viên dự kiến xem xét yêu cầu trong vòng 2 ngày làm việc của dịch vụ.",
      `Xem tiến độ trong Hồ sơ của tôi: ${env.DORTORY_SITE_ORIGIN ? env.DORTORY_SITE_ORIGIN + "/#/my-case" : RECEIPT_PORTAL}`,
    ] : [
      "도토리에 주거 상담 신청이 접수되었습니다.",
      `상담번호: ${item.id}`, date && `접수 일시(한국시간): ${date}`,
      "담당자는 운영일 기준 2일 이내에 신청 내용을 확인할 예정입니다.",
      `진행 상황 확인: ${env.DORTORY_SITE_ORIGIN ? env.DORTORY_SITE_ORIGIN + "/#/my-case" : RECEIPT_PORTAL}`,
    ]).filter(Boolean).join("\n\n"),
  };
}

async function deliverReceipt(item, env) {
  if (!item.contactEmail) return null;
  const db = env.DB;
  await db.prepare(`INSERT INTO dortory_receipts (case_id, account_id, state, attempted_at, first_attempt_at)
    VALUES (?, ?, 'queued', 0, 0) ON CONFLICT(case_id) DO NOTHING`).bind(item.id, item.accountId).run();
  const job = await findReceipt(db, item);
  const view = receiptView(item, job, env);
  if (!job || !view.retryable) return view;
  const now = Date.now();
  const priorAttemptUnconfirmed = ["sending", "unknown"].includes(job.state);
  const acquired = await db.prepare(`UPDATE dortory_receipts SET state='sending', attempted_at=?, first_attempt_at=?
    WHERE case_id=? AND account_id=? AND state=? AND attempted_at=?`)
    .bind(now, priorAttemptUnconfirmed ? job.first_attempt_at : now, item.id, item.accountId, job.state, job.attempted_at).run();
  if (!acquired.meta.changes) return receiptView(item, await findReceipt(db, item), env);

  let providerId = null;
  let state = "unknown";
  try {
    if (env.GMAIL_SENDER) {
      const result = await sendGmailReceipt(item, env);
      state = result.state; providerId = result.providerId ?? null;
      if (result.code) console.error(JSON.stringify({ service: "dortory", event: "mail.send", outcome: state, code: result.code }));
    } else {
    const response = await fetch(RECEIPT_API, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.RESEND_API_KEY.trim(),
        "Content-Type": "application/json",
        "Idempotency-Key": `dortory/receipt/${item.id}/${item.clientRequest}`,
      },
      body: JSON.stringify(receiptMessage(item, normalizeEmail(env.DORTORY_MAIL_FROM), env)),
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const payload = await response.json();
      if (typeof payload.id === "string" && payload.id) {
        providerId = payload.id;
        state = "sent";
      }
    } else {
      if (!priorAttemptUnconfirmed && response.status >= 400 && response.status < 500 && response.status !== 409) state = "failed";
      console.error("Dortory receipt provider HTTP", response.status);
    }
    }
  } catch {
    console.error("Dortory receipt provider could not confirm dispatch");
  }
  await db.prepare(`UPDATE dortory_receipts SET state=?, sent_at=?, provider_id=?
    WHERE case_id=? AND account_id=? AND state='sending' AND attempted_at=?`)
    .bind(state, providerId ? Date.now() : null, providerId, item.id, item.accountId, now).run();
  await recordAudit(env, { id: item.accountId, email: "" }, "mail.send", item.id, state === "sent" ? "success" : state, env.GMAIL_SENDER ? "gmail" : "resend");
  return receiptView(item, await findReceipt(db, item), env);
}

async function receiptForResponse(item, env, send) {
  if (!item.contactEmail) return null;
  try {
    env = await receiptRuntime(env);
    return send ? await deliverReceipt(item, env) : receiptView(item, await findReceipt(env.DB, item), env);
  } catch {
    console.error("Dortory receipt status could not be saved");
    return { state: "unknown", retryable: false };
  }
}

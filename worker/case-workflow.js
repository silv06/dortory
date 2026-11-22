const CASE_COMMANDS = {
  "confirm-intake": "intakeConfirmed",
  "select-housing": "housingSelected",
  "finish-ai-review": "aiReviewed",
  "prepare-visit": "docsPrepared",
  "schedule-visit": "visit",
  "confirm-contract": "contract",
  "record-submission": "submitted",
  "confirm-move": "complete",
};

function compareRecordValue(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

// The bulk workspace save may edit details, but only case commands can advance a case.
function preservesCaseWorkflow(before, after) {
  if (before.length !== after.length) return false;
  const previous = new Map(before.map((item) => [item.id, item]));
  return after.every((item) => {
    const old = previous.get(item.id);
    if (!old || !item.docs) return false;
    if (!["channel", "stage", "homeId", "transitId", "visitDate", "visitTime", "offers"].every((key) =>
      compareRecordValue(old[key], item[key]))) return false;
    if (old.docs.result !== item.docs.result) return false;
    if (!canEditCaseDocuments(old) && !compareRecordValue(old.docs, item.docs)) return false;
    return old.stage === "reviewing" || old.matchPreference === item.matchPreference;
  });
}

function validatedChecks(values) {
  if (!Array.isArray(values) || values.length > Object.keys(DOC_ITEMS).length
    || values.some((key) => typeof key !== "string" || !Object.hasOwn(DOC_ITEMS, key))) return [];
  return [...new Set(values)];
}

function hasCaseDraft(item) {
  const draft = item.docs.draft;
  return typeof draft?.housingText === "string" && Boolean(draft.housingText.trim())
    && typeof draft.terms === "string" && Boolean(draft.terms.trim()) && isoDate(draft.plannedDate);
}

function registerVisit(item, database, date, slot) {
  if (item.stage !== "visitReady") return "입주 서류 준비를 확인한 뒤 방문을 접수할 수 있습니다.";
  if (!isoDate(date) || !Object.hasOwn(VISIT_SLOTS, slot)) return "방문 날짜와 시간대를 확인해 주세요.";
  const placement = eligiblePlacement(item, database);
  if (!placement) return "선택한 주택 또는 통근 조건을 대장에서 다시 확인해 주세요.";
  Object.assign(item, { visitDate: date, visitTime: slot, stage: "visit" });
  item.history.push({ kind: "visit", detail: `${placement.home.name} · ${date} · ${VISIT_SLOTS[slot].ko}`, at: new Date().toISOString() });
  return "";
}

function applyCaseCommand(item, database, body) {
  const outOfOrder = "상담의 현재 단계를 확인하고 앞 단계를 먼저 완료해 주세요.";
  let detail = "";
  switch (body.action) {
    case "confirm-intake":
      if (item.stage !== "received") return outOfOrder;
      item.stage = "waiting";
      break;
    case "select-housing": {
      if (!canChooseHousing(item)) return outOfOrder;
      if (typeof body.homeId !== "string" || typeof body.transitId !== "string") return "선택할 주택과 통근편을 확인해 주세요.";
      const placement = eligiblePlacement(item, database, body.homeId, body.transitId);
      if (!placement) return "임대 조건과 왕복 운행을 확인한 조합만 선택할 수 있습니다.";
      const snapshot = housingSnapshot(placement);
      item.offers = [snapshot, ...item.offers.filter((offer) =>
        offer.homeId !== snapshot.homeId || offer.transitId !== snapshot.transitId)];
      Object.assign(item, { homeId: snapshot.homeId, transitId: snapshot.transitId, stage: "reviewing", waitReason: "" });
      detail = placement.home.name;
      break;
    }
    case "finish-ai-review":
      if (item.stage !== "reviewing") return outOfOrder;
      if (!eligiblePlacement(item, database)) return "주택·통근 조건이 바뀌었습니다. 비교에서 조합을 다시 확인해 주세요.";
      item.stage = "preparing";
      break;
    case "prepare-visit": {
      if (item.stage !== "preparing") return outOfOrder;
      const checked = validatedChecks(body.checked);
      if (!hasCaseDraft(item) || checked.length !== Object.keys(DOC_ITEMS).length) {
        return "입주 서류 초안을 저장하고 모든 준비 항목을 확인해 주세요.";
      }
      if (!eligiblePlacement(item, database)) return "선택한 주택 또는 통근 조건을 대장에서 다시 확인해 주세요.";
      item.docs.checked = checked;
      item.docs.requested = [];
      item.stage = "visitReady";
      break;
    }
    case "schedule-visit":
      return registerVisit(item, database, body.date, body.slot);
    case "confirm-contract":
      if (item.stage !== "visit") return outOfOrder;
      if (!eligiblePlacement(item, database)) return "계약을 확인하기 전에 주택·통근 조건을 다시 확인해 주세요.";
      item.stage = "docs";
      break;
    case "record-submission": {
      if (item.stage !== "docs") return outOfOrder;
      const checked = validatedChecks(body.checked);
      const result = typeof body.outcome === "string" ? body.outcome.trim() : "";
      if (!hasCaseDraft(item) || checked.length !== Object.keys(DOC_ITEMS).length || !result || result.length > 200) {
        return "서류 초안과 체크리스트를 확인하고 실제 제출 결과를 입력해 주세요.";
      }
      Object.assign(item.docs, { checked, requested: [], result });
      item.stage = "submitted";
      detail = result;
      break;
    }
    case "confirm-move":
      if (item.stage !== "submitted") return outOfOrder;
      item.stage = "complete";
      break;
    default:
      return "지원하지 않는 상담 작업입니다.";
  }
  item.history.push({ kind: CASE_COMMANDS[body.action], ...(detail && { detail }), at: new Date().toISOString() });
  return "";
}

async function runAdminCaseCommand(body, request, env) {
  if (!Object.hasOwn(CASE_COMMANDS, body.action) || typeof body.id !== "string" || !Number.isSafeInteger(body.revision)) {
    return json({ error: "상담 처리 요청을 확인해 주세요." }, 400);
  }
  const saved = await readOperations(env.DB);
  if (!saved || saved.revision !== body.revision) return json({ error: "상담이 변경됐습니다. 최신 기록을 다시 열어 주세요." }, 409);
  const item = saved.database.cases.find(({ id }) => id === body.id);
  if (!item) return json({ error: "상담을 찾을 수 없습니다." }, 404);
  const error = applyCaseCommand(item, saved.database, body);
  if (error) return json({ error }, 422);
  const status = await storeOperations(env.DB, saved.revision, saved.database,
    [identity(request), "case." + body.action, item.id, "success", ""]);
  if (status === 409) return json({ error: "상담이 변경됐습니다. 최신 기록을 다시 열어 주세요." }, 409);
  if (status !== 200) return json({ error: "상담 저장 용량을 확인해 주세요." }, status);
  return json({ record: item, revision: saved.revision + 1 });
}

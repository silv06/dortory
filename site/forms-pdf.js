// Placements are measured in points from the top-left of the published page.
// The issuer's underlying pages and text are preserved.
let pdfTools;
let formFont;
const filledPdfSources = new Map();

function loadFormScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = path;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(new Error("PDF 작성 도구를 불러오지 못했습니다.")); };
    document.head.append(script);
  });
}

async function loadFormAsset(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("공식 양식 자료를 불러오지 못했습니다.");
  return response.arrayBuffer();
}

async function loadPdfTools() {
  pdfTools ??= Promise.all([
    window.PDFLib || loadFormScript("/vendor/pdf-lib.min.js"),
    window.fontkit || loadFormScript("/vendor/fontkit.umd.min.js"),
  ]).catch((error) => { pdfTools = undefined; throw error; });
  await pdfTools;
}

function splitLines(font, text, size, width) {
  const lines = [];
  let line = "";
  for (const character of text) {
    if (font.widthOfTextAtSize(line + character, size) > width) {
      if (!line) return [text];
      const space = line.lastIndexOf(" ");
      if (space > 0 && character !== " ") {
        lines.push(line.slice(0, space));
        line = line.slice(space + 1) + character;
      } else {
        lines.push(line.trimEnd());
        line = character.trimStart();
      }
    } else line += character;
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}

function amountInHangul(amount) {
  if (amount === 0) return "영";
  const digits = "영일이삼사오육칠팔구";
  const units = ["", "십", "백", "천"];
  const groups = ["", "만", "억", "조"];
  const parts = [];
  let remaining = amount;
  for (const group of groups) {
    const word = [...String(remaining % 10000)].reverse().map((digit, index) => (
      Number(digit) ? digits[Number(digit)] + units[index] : ""
    )).reverse().join("");
    if (word) parts.unshift(word + group);
    remaining = Math.floor(remaining / 10000);
    if (!remaining) break;
  }
  return parts.join("");
}

function placeOfficialValues(document, font, kind, values, status) {
  const pages = document.getPages();
  const color = window.PDFLib.rgb(.05, .17, .30);
  const glyphs = new Set(font.getCharacterSet());
  function put(key, x, baseline, width, { page = 0, size = 9, rows = 1, value = values[key] } = {}) {
    if (value == null || value === "") return;
    const text = String(value).normalize("NFC").replace(/\s+/g, " ").trim();
    const label = OFFICIAL_FIELDS[key]?.[0] ?? "기입 항목";
    if ([...text].some((letter) => !glyphs.has(letter.codePointAt(0)))) {
      throw new Error(label + "에 PDF 글꼴이 지원하지 않는 문자가 있습니다. 해당 항목을 확인해 주세요.");
    }
    let lines = [text];
    while (size >= 6) {
      lines = rows > 1 ? splitLines(font, text, size, width) : [text];
      if (lines.length <= rows && lines.every((line) => font.widthOfTextAtSize(line, size) <= width)) break;
      size -= 0.5;
    }
    if (size < 6) throw new Error(label + "이 양식 칸에 들어가지 않습니다. 항목 표기를 확인해 주세요.");
    for (let i = 0; i < lines.length; i++) pages[page].drawText(lines[i], { x, y: pages[page].getHeight() - (baseline + i * (size + 2)), font, size, color });
  }
  function date(key, positions, baseline, page = 0) {
    if (!values[key]) return;
    const [year, month, day] = values[key].split("-");
    for (let i = 0; i < 3; i++) put(key, positions[i], baseline, i === 0 ? 31 : 17, { value: [year, month, day][i], page, size: 8 });
  }
  function tick(x, baseline, page = 0) {
    const y = pages[page].getHeight() - baseline;
    pages[page].drawLine({ start: { x, y }, end: { x: x + 3, y: y - 3 }, thickness: 1.1, color });
    pages[page].drawLine({ start: { x: x + 3, y: y - 3 }, end: { x: x + 8, y: y + 4 }, thickness: 1.1, color });
  }
  function selectMark(key, options) {
    const at = options[values[key]];
    if (Array.isArray(at)) tick(...at);
  }
  function amount(key, x, baseline, maxWidth) {
    if (values[key] !== "") {
      const numeric = Number(values[key]);
      if (Number.isFinite(numeric)) put(key, x, baseline, maxWidth, { value: numeric.toLocaleString("ko-KR"), size: 8.5 });
    }
  }
  function words(key, x, baseline, width) {
    if (!values[key]) return;
    const numeric = Number(values[key]);
    if (Number.isSafeInteger(numeric) && numeric >= 0) {
      put(key, x, baseline, width, { value: amountInHangul(numeric), size: 8 });
    }
  }
  function idDigits(key, startX, baseline, pitch, secondGroupOffset = 0) {
    const digits = values[key]?.replace(/\D/g, "");
    if (!digits) return;
    for (let i = 0; i < digits.length; i++) {
      put(key, startX + pitch * i + (i >= 6 ? secondGroupOffset : 0), baseline, 10, { size: 8.5, value: digits[i] });
    }
  }

  if (kind === "county") {
    put("fullName", 123, 142, 410);
    selectMark("sex", { male: [122, 169], female: [178, 169] });
    put("nationality", 292, 174, 52);
    put("phone", 430, 174, 105);
    idDigits("arc", 227, 207, 22.8, 22.8);
    put("address", 164, 241, 370, { rows: 2 });
    selectMark("countyResidence", { own: [168, 274], lease: [168, 289], other: [168, 304] });
    put("countyOther", 379, 306, 144, { size: 8 });
    put("signDate", 160, 362, 85);
  } else if (kind === "immigration") {
    tick(223, 225);
    put("lastName", 129, 313, 142, { size: 8 });
    put("givenName", 281, 313, 143, { size: 8 });
    date("birth", [132, 214, 264], 327);
    selectMark("sex", { male: [365, 326], female: [365, 337] });
    put("nationality", 480, 344, 55, { size: 8 });
    idDigits("arc", 190, 359, 19, 0);
    put("passport", 122, 380, 72, { size: 8 });
    put("address", 127, 402, 410, { size: 8 });
    put("phone", 405, 419, 130, { size: 8 });
    put("signDate", 162, 586, 122, { size: 8 });
  } else if (kind === "stay") {
    put("nationality", 171, 140, 76);
    put("arc", 393, 140, 134);
    put("fullName", 171, 176, 184);
    put("phone", 432, 176, 95);
    put("address", 171, 198, 356, { rows: 2 });
    put("providerNationality", 171, 271, 68);
    put("providerArc", 382, 271, 145);
    put("provider", 171, 306, 201);
    put("providerPhone", 432, 306, 95);
    selectMark("relationship", { family: [174, 340], employer: [264, 340], other: [359, 340] });
    selectMark("ownership", { own: [174, 373], rent: [264, 373], other: [374, 373] });
    selectMark("stayType", { private: [174, 402], dorm: [318, 402], lodging: [174, 430], other: [318, 430] });
    put("relationshipOther", 433, 329, 87, { size: 8 });
    put("ownershipOther", 435, 367, 83, { size: 8 });
    put("stayOther", 397, 425, 122, { size: 8 });
    date("providedOn", [177, 267, 354], 459);
    date("providedSigned", [180, 254, 319], 522);
    if (!values.company) put("provider", 257, 544, 63, { size: 8 });
    put("company", 257, 560, 63, { size: 8 });
  } else if (kind === "lease") {
    selectMark("leaseType", { depositRent: [459, 64], jeonse: [459, 77], rent: [511, 77] });
    selectMark("contractType", { new: [102, 214], renewed: [327, 214], statutory: [102, 229] });
    put("lessor", 103, 102, 85, { size: 8 });
    put("fullName", 255, 102, 85, { size: 8 });
    put("address", 163, 149, 409, { size: 8 });
    put("building", 159, 182, 175, { size: 8 });
    if (values.unit) {
      pages[0].drawRectangle({ x: 100, y: pages[0].getHeight() - 204, width: 239, height: 15, color: window.PDFLib.rgb(1, 1, 1) });
    }
    put("unit", 101, 199, 230, { size: 8 });
    put("areaM2", 371, 199, 170, { size: 8 });
    words("deposit", 122, 409, 166);
    amount("deposit", 329, 409, 123);
    words("firstPayment", 121, 428, 76);
    amount("firstPayment", 231, 428, 67);
    words("interimPayment", 121, 448, 76);
    amount("interimPayment", 231, 448, 67);
    words("lastPayment", 121, 467, 76);
    amount("lastPayment", 231, 467, 67);
    words("rent", 122, 487, 75);
    put("rentDay", 265, 487, 13, { size: 8 });
    words("bills", 218, 507, 88);
    amount("bills", 345, 507, 133);
    date("interimDate", [346, 402, 452], 448);
    date("lastDate", [346, 402, 452], 467);
    date("leaseFrom", [435, 479, 515], 657);
    date("leaseUntil", [277, 351, 408], 669);
    date("contractSigned", [406, 475, 530], 125, 2);
    put("leaseExtras", 87, 41, 480, { page: 2, rows: 2 });
    put("lessorAddress", 128, 154, 375, { page: 2 });
    put("lessorArc", 128, 179, 133, { page: 2 });
    put("lessorPhone", 338, 179, 70, { page: 2, size: 8 });
    put("lessor", 450, 173, 62, { page: 2, size: 8, rows: 2 });
    put("tenantAddress", 128, 228, 375, { page: 2 });
    put("arc", 128, 253, 133, { page: 2 });
    put("phone", 338, 253, 70, { page: 2, size: 8 });
    put("fullName", 450, 247, 62, { page: 2, size: 8, rows: 2 });
  }
  if (status) pages.forEach((page, index) => put(null, 31, 20, page.getWidth() - 63, { page: index, value: status, size: 9 }));
}

async function downloadOfficialForm(form, button) {
  const record = currentRecord();
  if (!record || !button) return;
  rememberOfficialFields(form);
  const { kind, values: sessionValues, sample } = officialSession(record);
  const demo = sample || record.channel === "demo";
  const values = { ...sessionValues };
  const error = form.querySelector("[data-error]");
  const info = form.querySelector("#official-feedback");
  error.textContent = "";
  if (kind === "lease" && values.leaseFrom && values.leaseUntil && values.leaseFrom >= values.leaseUntil) {
    error.textContent = "계약 종료일을 임차주택 인도일 뒤로 지정해 주세요.";
    return;
  }
  if (["county", "immigration"].includes(kind) && values.signDate && values.moveOn && values.signDate < values.moveOn) {
    error.textContent = "신고일이 실제 전입일보다 앞섭니다. 두 날짜를 확인해 주세요.";
    return;
  }
  button.disabled = true;
  button.textContent = "PDF에 기입하는 중…";
  try {
    const source = OFFICIAL_FORMS[kind];
    if (!filledPdfSources.has(kind)) {
      filledPdfSources.set(kind, loadFormAsset(`/forms/${source.file}.pdf`).catch((exception) => {
        filledPdfSources.delete(kind);
        throw exception;
      }));
    }
    formFont ??= loadFormAsset("/forms/noto-sans-kr.ttf").catch((exception) => { formFont = undefined; throw exception; });
    const [, bytes, fontBytes] = await Promise.all([loadPdfTools(), filledPdfSources.get(kind), formFont]);
    const document = await window.PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    document.registerFontkit(window.fontkit);
    const font = await document.embedFont(fontBytes);
    const missing = missingOfficial(kind, values);
    placeOfficialValues(document, font, kind, values, demo ? "시연용 · 가상 입력값" : missing.length ? "미완성 초안 · 추가 항목 확인" : "");
    const url = URL.createObjectURL(new Blob([await document.save()], { type: "application/pdf" }));
    const download = window.document.createElement("a");
    download.href = url;
    download.download = `도토리-${source.file}-${demo ? "시연" : "작성본"}.pdf`;
    window.document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    info.textContent = missing.length ? "입력된 항목을 담은 PDF 초안을 내려받았습니다. 표시된 항목을 확인하세요."
      : "입력된 항목을 공식 양식에 기입했습니다. 내려받은 PDF에서 값과 서명란을 확인하세요.";
  } catch (exception) {
    error.textContent = exception.message || "PDF를 만들지 못했습니다. 입력값을 확인해 주세요.";
  } finally {
    button.disabled = false;
    button.textContent = "공식 양식 PDF 다운로드";
  }
}

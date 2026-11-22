function aftercareStatus(status) {
  return statusTag(localize(AFTERCARE_STATES[status]), status === "resolved" ? "done" : status === "received" ? "attention" : "working");
}

function aftercareHistory(ticket) {
  if (!ticket.updates.length) return "";
  return `<ol class="aftercare-updates">${ticket.updates.map((update) => `<li>
    <p><strong>${localize(AFTERCARE_STATES[update.status])}</strong> · ${displayDate(update.at, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</p>
    ${update.message ? `<p class="aftercare-text">${escapeHtml(update.message)}</p>` : ""}
  </li>`).join("")}</ol>`;
}

function aftercareTicket(ticket, staff) {
  const statusId = "status-" + ticket.id;
  const replyId = "reply-" + ticket.id;
  const id = escapeHtml(ticket.id);
  return `<article class="aftercare-item">
    <div class="panel-heading"><div><h3>${localize(AFTERCARE_TYPES[ticket.category])}</h3>
      <p class="subtle">${displayDate(ticket.createdAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}</p></div>
      ${aftercareStatus(ticket.status)}</div>
    <p class="aftercare-text">${escapeHtml(ticket.message)}</p>
    ${aftercareHistory(ticket)}
    ${staff ? `<details class="aftercare-reply"><summary>상태·답변 기록</summary>
      <form id="aftercare-reply-${id}" data-aftercare-ticket="${id}">
        ${field("처리 상태", statusId, select(statusId, areaOptions(AFTERCARE_STATES), ticket.status))}
        ${field("이용자에게 보일 답변", replyId, `<textarea id="${replyId}" name="${replyId}" maxlength="800" rows="3"></textarea>`)}
        <p class="form-error" data-error role="alert"></p>
        <button class="button button-soft" type="submit">상태·답변 저장</button>
      </form></details>` : ""}
  </article>`;
}

function aftercarePanel(record, staff = false) {
  if (!caseCanUseAftercare(record)) return "";
  const items = record.aftercare ?? [];
  return `<section class="paper aftercare-panel">
    <div class="panel-heading"><h2>${label("사후관리", "Hỗ trợ sau khi ghép nhà")}</h2>
      ${items.length ? `<span class="subtle">${label(`요청 ${items.length}건`, `${items.length} yêu cầu`)}</span>` : ""}</div>
    ${staff ? "" : `<form id="aftercare-form">
      ${field(label("요청 유형", "Loại yêu cầu"), "aftercareCategory", select("aftercareCategory", areaOptions(AFTERCARE_TYPES), "housing"))}
      ${field(label("도움이 필요한 내용", "Nội dung cần hỗ trợ"), "aftercareMessage",
        '<textarea id="aftercareMessage" name="aftercareMessage" rows="3" maxlength="800" required></textarea>')}
      <p class="form-error" data-error role="alert"></p>
      <button class="button" type="submit">${label("사후관리 요청 보내기", "Gửi yêu cầu hỗ trợ")}</button>
    </form>`}
    ${items.length ? `<div class="aftercare-items">${items.map((ticket) => aftercareTicket(ticket, staff)).join("")}</div>`
      : `<p class="subtle">${label("접수된 사후관리 요청이 없습니다.", "Chưa có yêu cầu hỗ trợ.")}</p>`}
  </section>`;
}

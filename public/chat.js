const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const domainSel = document.getElementById("domain");
const newChatBtn = document.getElementById("newChat");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("backdrop");
const convListEl = document.getElementById("convList");
const userEmailEl = document.getElementById("userEmail");

const history = [];
let conversationId = null;
let controller = null;       // AbortController của lượt đang stream
let streaming = false;
let lastQuestion = null;

const EXAMPLES = [
  "Tháng này có bao nhiêu đơn bán hàng?",
  "Top 5 khách hàng theo doanh thu?",
  "Tổng công nợ phải thu hiện tại là bao nhiêu?",
  "Cách tạo hóa đơn bán hàng cho khách trong Odoo?",
];

/* ---------------- Markdown render (escape trước → an toàn XSS) ---------------- */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function splitRow(line) {
  return line.replace(/^\s*\|?/, "").replace(/\|?\s*$/, "").split("|").map((c) => c.trim());
}
function renderMarkdown(md) {
  const lines = escapeHtml(md).replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let i = 0;
  const isBlockStart = (l) =>
    /^(#{1,6}\s|```|>\s?|\s*[-*+]\s|\s*\d+\.\s)/.test(l) || /^(\-{3,}|\*{3,}|_{3,})\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      html += `<pre><code>${buf.join("\n")}</code></pre>`;
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) { const lvl = Math.min(m[1].length + 2, 6); html += `<h${lvl}>${inlineMd(m[2])}</h${lvl}>`; i++; continue; }
    if (/^(\-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html += "<hr>"; i++; continue; }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line); i += 2;
      let rows = "";
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) {
        rows += "<tr>" + splitRow(lines[i]).map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>"; i++;
      }
      html += `<table><thead><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html += `<blockquote>${inlineMd(buf.join("<br>"))}</blockquote>`;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      let items = "";
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items += `<li>${inlineMd(lines[i++].replace(/^\s*[-*+]\s+/, ""))}</li>`;
      html += `<ul>${items}</ul>`;
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      let items = "";
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items += `<li>${inlineMd(lines[i++].replace(/^\s*\d+\.\s+/, ""))}</li>`;
      html += `<ol>${items}</ol>`;
      continue;
    }
    const buf = [line]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) buf.push(lines[i++]);
    html += `<p>${inlineMd(buf.join("<br>"))}</p>`;
  }
  return html;
}

/* ---------------- Tiện ích & màn hình chào ---------------- */
function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
function clearEmpty() { const e = messagesEl.querySelector(".empty"); if (e) e.remove(); }
function renderEmpty() {
  messagesEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "empty";
  wrap.innerHTML =
    '<img src="/logo.png" alt="Daisan Group" class="empty-logo-img" />' +
    "<h2>Chào mừng đến Trợ lý AI nội bộ Daisan</h2>" +
    "<p>Hỏi về số liệu trực tiếp trong Odoo (đơn hàng, doanh thu, công nợ, tồn kho…) và quy trình/SOP nội bộ — mình trả lời dựa trên dữ liệu sống + tài liệu nội bộ, luôn kèm nguồn.</p>" +
    '<div class="examples"></div>';
  const _lg = wrap.querySelector(".empty-logo-img");
  if (_lg) _lg.onerror = () => { _lg.outerHTML = '<div class="empty-logo">✦</div>'; };
  const ex = wrap.querySelector(".examples");
  EXAMPLES.forEach((q) => {
    const c = document.createElement("button");
    c.className = "example"; c.type = "button"; c.textContent = q;
    c.addEventListener("click", () => { input.value = q; form.requestSubmit(); });
    ex.appendChild(c);
  });
  messagesEl.appendChild(wrap);
}

/* ---------------- Khung tin nhắn ---------------- */
function addMessage(role, text) {
  clearEmpty();
  const turn = document.createElement("div");
  turn.className = `turn ${role}`;
  if (role === "assistant") {
    const av = document.createElement("div");
    av.className = "avatar"; av.textContent = "✦";
    turn.appendChild(av);
  }
  const content = document.createElement("div");
  content.className = "content";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  content.appendChild(bubble);
  turn.appendChild(content);
  messagesEl.appendChild(turn);
  scrollBottom();
  return bubble;
}
function renderFinal(role, content, sources, messageId, feedback) {
  const bubble = addMessage(role, content);
  if (role === "assistant") {
    bubble.classList.add("md");
    bubble.innerHTML = renderMarkdown(content);
    bubble.__md = content; bubble.__sources = sources || [];
    renderSources(bubble, sources);
    addActions(bubble, messageId, feedback);
  } else if (role === "user") {
    addUserActions(bubble, history.length - 1);
  }
}
function renderSources(bubble, sources) {
  if (!sources || sources.length === 0) return;
  const box = document.createElement("div");
  box.className = "sources";
  box.appendChild(document.createTextNode("Nguồn: "));
  for (const s of sources) {
    // Nguồn dạng "phong/ten-file.pdf" -> link mở tài liệu; nguồn khác (vd Odoo) -> nhãn thường.
    const isDoc = typeof s === "string" && s.includes("/");
    if (isDoc) {
      const name = s.split("/").pop();
      const a = document.createElement("a");
      a.className = "source-link";
      a.href = "/api/doc?key=" + encodeURIComponent(s);
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Mở tài liệu: " + s;
      a.textContent = "📄 " + name;
      box.appendChild(a);
    } else {
      const tag = document.createElement("span");
      tag.textContent = s;
      box.appendChild(tag);
    }
  }
  bubble.parentElement.appendChild(box);
}

/* ---------------- Thanh nút dưới câu trả lời ---------------- */
function flash(btn, msg) {
  const span = btn.querySelector("span");
  const old = span.dataset.label;
  span.textContent = msg;
  btn.classList.add("done");
  setTimeout(() => { span.textContent = old; btn.classList.remove("done"); }, 1400);
}
function addActions(bubble, messageId, feedback) {
  const bar = document.createElement("div");
  bar.className = "actions";
  const text = () => bubble.innerText.trim();
  const mk = (label, icon, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${icon}<span data-label="${label}">${label}</span>`;
    b.addEventListener("click", () => fn(b));
    bar.appendChild(b);
  };
  mk("Tạo lại", "🔄", () => { if (!streaming) regenerate(); });
  mk("Copy", "📋", async (b) => {
    try { await navigator.clipboard.writeText(text()); flash(b, "Đã copy ✓"); } catch { flash(b, "Lỗi copy"); }
  });
  mk("Sửa", "✏️", (b) => {
    const span = b.querySelector("span");
    const on = bubble.getAttribute("contenteditable") === "true";
    bubble.setAttribute("contenteditable", on ? "false" : "true");
    bubble.classList.toggle("editing", !on);
    span.textContent = on ? "Sửa" : "Xong"; span.dataset.label = on ? "Sửa" : "Xong";
    if (!on) bubble.focus();
  });
  mk("Gmail", "📧", () => openGmail(bubble));
  mk("Chia sẻ", "🔗", async (b) => {
    const t = text();
    if (navigator.share) { try { await navigator.share({ title: "Trợ lý AI nội bộ Daisan", text: t }); } catch {} }
    else { try { await navigator.clipboard.writeText(t); flash(b, "Đã copy để chia sẻ ✓"); } catch {} }
  });
  if (messageId) addFeedback(bar, messageId, feedback || 0);
  addExportControl(bar, bubble);
  bubble.parentElement.appendChild(bar);
}

/* ---- Thanh nút cho CÂU HỎI của người dùng (Copy / Sửa & gửi lại) ---- */
function addUserActions(bubble, histIndex) {
  const bar = document.createElement("div");
  bar.className = "actions user-actions";
  const mk = (label, icon, fn) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `${icon}<span data-label="${label}">${label}</span>`;
    b.addEventListener("click", () => fn(b));
    bar.appendChild(b);
  };
  mk("Copy", "📋", async (b) => {
    try { await navigator.clipboard.writeText(bubble.textContent); flash(b, "Đã copy ✓"); }
    catch { flash(b, "Lỗi copy"); }
  });
  mk("Sửa", "✏️", () => startEditUser(bubble, histIndex));
  bubble.parentElement.appendChild(bar);
}

/* Bật ô sửa câu hỏi tại chỗ; gửi lại sẽ thay câu hỏi và để trợ lý trả lời lại. */
function startEditUser(bubble, histIndex) {
  const content = bubble.parentElement;
  if (content.querySelector(".edit-box")) return; // đang sửa rồi
  const original = (history[histIndex] && history[histIndex].content) || bubble.textContent;
  const bar = content.querySelector(".user-actions");

  const box = document.createElement("div");
  box.className = "edit-box";
  const ta = document.createElement("textarea");
  ta.className = "edit-area"; ta.value = original;
  const row = document.createElement("div");
  row.className = "edit-row";
  const save = document.createElement("button");
  save.type = "button"; save.className = "edit-save"; save.textContent = "↑ Gửi lại";
  const cancel = document.createElement("button");
  cancel.type = "button"; cancel.className = "edit-cancel"; cancel.textContent = "Huỷ";
  row.append(cancel, save);
  box.append(ta, row);

  bubble.style.display = "none";
  if (bar) bar.style.display = "none";
  content.appendChild(box);

  const autoresize = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
  autoresize(); ta.addEventListener("input", autoresize);
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);

  const close = () => { box.remove(); bubble.style.display = ""; if (bar) bar.style.display = ""; };
  cancel.addEventListener("click", close);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save.click(); }
  });
  save.addEventListener("click", () => {
    const nt = ta.value.trim();
    if (!nt) return;
    resubmitEdited(content.closest(".turn"), histIndex, nt);
  });
}

/* Cắt hội thoại về trước câu hỏi được sửa, rồi hỏi lại với nội dung mới. */
async function resubmitEdited(turnEl, histIndex, newText) {
  if (streaming && controller) controller.abort(); // dừng luồng cũ (sẽ bị bỏ qua)
  history.length = histIndex;                       // bỏ câu hỏi này + mọi thứ sau nó
  let el = turnEl;                                   // xoá DOM từ câu hỏi này trở đi
  while (el) { const next = el.nextElementSibling; el.remove(); el = next; }
  await ask(newText);
}

/* Nút 👍/👎 đánh giá câu trả lời. Bấm lại cùng nút để bỏ chọn. */
function addFeedback(bar, messageId, current) {
  const wrap = document.createElement("div");
  wrap.className = "fb-wrap";
  let value = current || 0;
  const up = document.createElement("button");
  up.type = "button"; up.className = "fb"; up.title = "Hữu ích"; up.textContent = "👍";
  const down = document.createElement("button");
  down.type = "button"; down.className = "fb"; down.title = "Chưa tốt"; down.textContent = "👎";
  const sync = () => {
    up.classList.toggle("on", value === 1);
    down.classList.toggle("on", value === -1);
  };
  const send = async (v) => {
    value = value === v ? 0 : v; // bấm lại = bỏ chọn
    sync();
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId, value }),
      });
    } catch {}
  };
  up.addEventListener("click", () => send(1));
  down.addEventListener("click", () => send(-1));
  sync();
  wrap.append(up, down);
  bar.appendChild(wrap);
}

/* ---------------- Xuất tài liệu (Word / PDF / Excel / Markdown) ---------------- */
const DOC_CSS = `
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 820px; margin: 0 auto; padding: 30px 36px; }
.doc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 12px; }
.doc-brand { font-weight: 700; color: #4f46e5; font-size: 15px; }
.doc-date { font-size: 12px; color: #666; }
h1.doc-q { font-size: 19px; margin: 20px 0 6px; color: #111; }
.doc-body { font-size: 14px; }
.doc-body h1, .doc-body h2, .doc-body h3, .doc-body h4, .doc-body h5, .doc-body h6 { margin: 16px 0 6px; line-height: 1.3; }
.doc-body h3 { font-size: 16px; } .doc-body h4 { font-size: 14.5px; }
.doc-body p { margin: 9px 0; }
.doc-body ul, .doc-body ol { margin: 9px 0; padding-left: 24px; }
.doc-body li { margin: 4px 0; }
.doc-body table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.doc-body th, .doc-body td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
.doc-body th { background: #f3f4f6; font-weight: 600; }
.doc-body code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.9em; }
.doc-body pre { background: #f6f8fa; border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px; overflow: auto; }
.doc-body pre code { background: none; padding: 0; }
.doc-body blockquote { border-left: 3px solid #4f46e5; background: #f5f3ff; margin: 10px 0; padding: 8px 14px; color: #333; }
.doc-body a { color: #4f46e5; }
.doc-sources { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #555; }
.doc-foot { margin-top: 26px; font-size: 11px; color: #999; text-align: center; }
@page { margin: 1.6cm; }
@media print { body { padding: 0; max-width: none; } }
`;

function exportMeta(bubble) {
  const turn = bubble.closest(".turn");
  const prev = turn ? turn.previousElementSibling : null;
  const q = prev && prev.classList.contains("user") ? (prev.querySelector(".bubble")?.innerText || "").trim() : "";
  return {
    question: q || "Câu trả lời từ Trợ lý AI Daisan",
    md: bubble.__md != null ? bubble.__md : bubble.innerText,
    sources: bubble.__sources || [],
    bodyHtml: bubble.innerHTML,
  };
}

function buildDocHtml(question, bodyHtml, sources, forPrint) {
  const when = new Date().toLocaleString("vi-VN");
  const src = sources && sources.length
    ? `<div class="doc-sources"><strong>Nguồn:</strong> ${sources.map(escapeHtml).join(" • ")}</div>` : "";
  const printScript = forPrint
    ? '<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script>' : "";
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(question)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${DOC_CSS}</style></head>
<body>
<div class="doc-header"><div class="doc-brand">✦ Trợ lý AI nội bộ — Daisan Group</div><div class="doc-date">Xuất ngày ${escapeHtml(when)}</div></div>
<h1 class="doc-q">${escapeHtml(question)}</h1>
<div class="doc-body">${bodyHtml}</div>
${src}
<div class="doc-foot">Tài liệu tạo tự động từ Trợ lý AI nội bộ Daisan • Lưu hành nội bộ</div>
${printScript}
</body></html>`;
}

function exportWord(bubble) {
  const { question, bodyHtml, sources } = exportMeta(bubble);
  const html = buildDocHtml(question, bodyHtml, sources, false);
  downloadBlob(new Blob(["﻿", html], { type: "application/msword" }), exportName(question, "doc"));
}
function exportPdf(bubble) {
  const { question, bodyHtml, sources } = exportMeta(bubble);
  const html = buildDocHtml(question, bodyHtml, sources, true);
  const w = window.open("", "_blank");
  if (!w) { alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up cho trang này rồi thử lại."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
function exportMarkdown(bubble) {
  const { question, md, sources } = exportMeta(bubble);
  const when = new Date().toLocaleString("vi-VN");
  const srcLine = sources && sources.length ? `\n\n---\n**Nguồn:** ${sources.join(" • ")}` : "";
  const text = `# ${question}\n\n${md}${srcLine}\n\n_Xuất từ Trợ lý AI nội bộ Daisan — ${when}_\n`;
  downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), exportName(question, "md"));
}
function exportCsv(bubble) {
  const { question } = exportMeta(bubble);
  const tables = [...bubble.querySelectorAll("table")];
  if (!tables.length) return;
  const csv = tables.map(tableToCsv).join("\r\n\r\n");
  downloadBlob(new Blob(["﻿", "sep=,\r\n", csv], { type: "text/csv;charset=utf-8" }), exportName(question, "csv"));
}
function tableToCsv(table) {
  return [...table.querySelectorAll("tr")]
    .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => csvCell(c.innerText)).join(","))
    .join("\r\n");
}
function csvCell(s) { s = (s || "").trim().replace(/"/g, '""'); return /[",\n;]/.test(s) ? `"${s}"` : s; }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function exportSlug(s) {
  return (s || "tai-lieu").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "tai-lieu";
}
function exportName(question, ext) {
  return `Daisan-AI_${exportSlug(question)}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

/* Mở cửa sổ soạn thư Gmail, điền sẵn tiêu đề + nội dung câu trả lời + nguồn. */
function openGmail(bubble) {
  const { question, md, sources } = exportMeta(bubble);
  const subject = "[Trợ lý AI Daisan] " + question;
  let body = (md || "").trim();
  if (body.length > 1800) body = body.slice(0, 1800) + "\n\n… (rút gọn — xem đầy đủ trong Trợ lý AI Daisan)";
  if (sources && sources.length) body += "\n\n— Nguồn: " + sources.join(" • ");
  body += "\n\n(Gửi từ Trợ lý AI nội bộ Daisan)";
  const url = "https://mail.google.com/mail/?view=cm&fs=1&su=" +
    encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  window.open(url, "_blank", "noopener");
}

function addExportControl(bar, bubble) {
  const wrap = document.createElement("div");
  wrap.className = "export-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerHTML = '⬇️<span data-label="Xuất">Xuất</span><span class="caret">▾</span>';
  const menu = document.createElement("div");
  menu.className = "export-menu";
  const item = (label, fn) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.remove("open"); fn(); });
    menu.appendChild(b);
  };
  item("📄  Word (.doc)", () => exportWord(bubble));
  item("🖨️  PDF (in / lưu PDF)", () => exportPdf(bubble));
  if (bubble.querySelector("table")) item("📊  Excel (.csv)", () => exportCsv(bubble));
  item("⬇️  Markdown (.md)", () => exportMarkdown(bubble));
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".export-menu.open").forEach((m) => { if (m !== menu) m.classList.remove("open"); });
    menu.classList.toggle("open");
  });
  wrap.append(btn, menu);
  bar.appendChild(wrap);
}

/* ---------------- Lịch sử hội thoại (sidebar) ---------------- */
function markActive() {
  convListEl.querySelectorAll(".conv-item").forEach((el) => el.classList.toggle("active", el.dataset.id === conversationId));
}
async function loadConversations() {
  try {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const { conversations } = await res.json();
    convListEl.innerHTML = "";
    if (!conversations.length) { convListEl.innerHTML = '<p class="conv-empty">Chưa có cuộc trò chuyện nào.</p>'; return; }
    for (const c of conversations) {
      const item = document.createElement("div");
      item.className = "conv-item"; item.dataset.id = c.id;
      const title = document.createElement("span");
      title.className = "conv-title"; title.textContent = c.title; title.title = "Bấm đúp để đổi tên";
      title.addEventListener("dblclick", (e) => { e.stopPropagation(); startRename(item, c, title); });
      const del = document.createElement("button");
      del.className = "conv-del"; del.type = "button"; del.textContent = "✕"; del.title = "Xóa";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (del.dataset.confirm === "1") { doDelete(c.id); return; }
        del.dataset.confirm = "1"; del.textContent = "Xóa?"; del.classList.add("confirm");
        setTimeout(() => { if (del.dataset.confirm === "1") { del.dataset.confirm = ""; del.textContent = "✕"; del.classList.remove("confirm"); } }, 2500);
      });
      item.appendChild(title); item.appendChild(del);
      item.addEventListener("click", () => loadConversation(c.id));
      convListEl.appendChild(item);
    }
    markActive();
  } catch {}
}
function startRename(item, c, title) {
  const inp = document.createElement("input");
  inp.className = "conv-rename"; inp.value = c.title;
  title.replaceWith(inp); inp.focus(); inp.select();
  let saved = false;
  const finish = async (save) => {
    if (saved) return; saved = true;
    const nv = inp.value.trim();
    if (save && nv && nv !== c.title) {
      try { await fetch(`/api/conversations/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: nv }) }); } catch {}
    }
    loadConversations();
  };
  inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); });
  inp.addEventListener("blur", () => finish(true));
}
async function loadConversation(id) {
  try {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const conv = await res.json();
    conversationId = conv.id;
    history.length = 0;
    messagesEl.innerHTML = "";
    for (const m of conv.messages) { history.push({ role: m.role, content: m.content }); renderFinal(m.role, m.content, m.sources, m.id, m.feedback); }
    markActive(); closeSidebar(); scrollBottom();
  } catch {}
}
async function doDelete(id) {
  try { await fetch(`/api/conversations/${id}`, { method: "DELETE" }); } catch {}
  if (id === conversationId) { conversationId = null; history.length = 0; renderEmpty(); }
  loadConversations();
}
async function loadMe() {
  try {
    const res = await fetch("/api/me");
    const { email, departments, canAssign } = await res.json();
    if (email && email !== "dev@local") userEmailEl.textContent = email;
    // Phân quyền: chỉ giữ các phòng người dùng được phép (luôn giữ "Tất cả").
    if (Array.isArray(departments)) {
      [...domainSel.options].forEach((o) => {
        if (o.value && !departments.includes(o.value)) o.remove();
      });
    }
    if (canAssign && assignBtn) assignBtn.style.display = "flex";
  } catch {}
}

/* ---------------- Giao việc (Odoo) ---------------- */
const assignBtn = document.getElementById("assignBtn");
const assignModal = document.getElementById("assignModal");
const asgProject = document.getElementById("asgProject");
const asgUsers = document.getElementById("asgUsers");
const asgTitle = document.getElementById("asgTitle");
const asgDesc = document.getElementById("asgDesc");
const asgDeadline = document.getElementById("asgDeadline");
const asgStatus = document.getElementById("asgStatus");
const asgSubmit = document.getElementById("asgSubmit");
const asgCancel = document.getElementById("asgCancel");
let assignOptionsLoaded = false;

function closeAssign() { if (assignModal) assignModal.hidden = true; }
async function openAssign() {
  assignModal.hidden = false;
  if (assignOptionsLoaded) return;
  asgProject.innerHTML = '<option value="">(Không thuộc dự án)</option>';
  asgStatus.textContent = "Đang tải dự án & nhân sự…"; asgStatus.style.color = "var(--muted)";
  try {
    const res = await fetch("/api/assign/options");
    const d = await res.json();
    if (!res.ok) { asgStatus.textContent = "⚠️ " + (d.error || "Lỗi tải"); asgStatus.style.color = "#ff8a8a"; return; }
    if ((d.projects || []).length) {
      asgProject.innerHTML += d.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    }
    asgUsers.innerHTML = (d.assignees || []).map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("");
    // Coi như đã tải khi có người nhận (không có người nhận thì cho thử lại lần sau).
    assignOptionsLoaded = (d.assignees || []).length > 0;
    const warn = [];
    if (!(d.projects || []).length) warn.push("Chưa lấy được dự án nào — vẫn có thể giao việc không thuộc dự án.");
    if (!(d.assignees || []).length) warn.push("Chưa lấy được danh sách người nhận từ Odoo.");
    if (d.errors && d.errors.length) warn.push(...d.errors);
    asgStatus.innerHTML = warn.length ? "⚠️ " + warn.map(escapeHtml).join("<br>") : "";
    asgStatus.style.color = warn.length ? "#e0a341" : "";
  } catch (e) { asgStatus.textContent = "⚠️ " + e.message; asgStatus.style.color = "#ff8a8a"; }
}
if (assignBtn) assignBtn.addEventListener("click", () => { closeSidebar(); openAssign(); });
if (asgCancel) asgCancel.addEventListener("click", closeAssign);
if (assignModal) assignModal.addEventListener("click", (e) => { if (e.target === assignModal) closeAssign(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && assignModal && !assignModal.hidden) closeAssign(); });
if (asgSubmit) asgSubmit.addEventListener("click", async () => {
  const name = asgTitle.value.trim();
  const assigneeIds = [...asgUsers.selectedOptions].map((o) => Number(o.value));
  if (!name) { asgStatus.textContent = "⚠️ Nhập tiêu đề công việc."; asgStatus.style.color = "#ff8a8a"; return; }
  if (!assigneeIds.length) { asgStatus.textContent = "⚠️ Chọn ít nhất một người nhận."; asgStatus.style.color = "#ff8a8a"; return; }
  asgSubmit.disabled = true; asgStatus.textContent = "Đang tạo công việc trong Odoo…"; asgStatus.style.color = "var(--muted)";
  try {
    const res = await fetch("/api/assign", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        description: asgDesc.value.trim() || undefined,
        projectId: asgProject.value ? Number(asgProject.value) : undefined,
        assigneeIds,
        deadline: asgDeadline.value || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok && d.ok) {
      asgStatus.innerHTML = "✅ Đã giao việc (task #" + d.taskId + "). Odoo sẽ thông báo cho người nhận." +
        (d.activityWarning ? "<br><span style='color:#e0a341'>Lưu ý: hoạt động nhắc việc chưa tạo được (" + escapeHtml(d.activityWarning) + ")</span>" : "");
      asgStatus.style.color = "#4ade80";
      asgTitle.value = ""; asgDesc.value = ""; asgDeadline.value = "";
      [...asgUsers.options].forEach((o) => (o.selected = false));
    } else { asgStatus.textContent = "❌ " + (d.error || "Lỗi"); asgStatus.style.color = "#ff8a8a"; }
  } catch (e) { asgStatus.textContent = "❌ " + e.message; asgStatus.style.color = "#ff8a8a"; }
  asgSubmit.disabled = false;
});

/* ---------------- Nhập khách hàng (CRM Odoo) ---------------- */
const customerBtn = document.getElementById("customerBtn");
const customerModal = document.getElementById("customerModal");
const cusGroup = document.getElementById("cusGroup");
const cusName = document.getElementById("cusName");
const cusCompany = document.getElementById("cusCompany");
const cusContact = document.getElementById("cusContact");
const cusPhone = document.getElementById("cusPhone");
const cusEmail = document.getElementById("cusEmail");
const cusNote = document.getElementById("cusNote");
const cusStatus = document.getElementById("cusStatus");
const cusSubmit = document.getElementById("cusSubmit");
const cusCancel = document.getElementById("cusCancel");
let cusGroupsLoaded = false;

function closeCustomer() { if (customerModal) customerModal.hidden = true; }
async function openCustomer() {
  customerModal.hidden = false;
  cusStatus.textContent = "";
  if (cusGroupsLoaded) return;
  try {
    const d = await (await fetch("/api/crm/groups")).json();
    cusGroup.innerHTML = '<option value="">(Chưa chọn nhóm)</option>' +
      (d.groups || []).map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
    cusGroupsLoaded = true;
    if (!(d.groups || []).length) {
      cusStatus.innerHTML = "⚠️ Quản trị chưa lập 'Nhóm sản phẩm → nhân sự'. Vẫn lưu được khách (chưa tự định tuyến).";
      cusStatus.style.color = "#e0a341";
    }
  } catch (e) { cusStatus.textContent = "⚠️ " + e.message; cusStatus.style.color = "#ff8a8a"; }
}
if (customerBtn) customerBtn.addEventListener("click", () => { closeSidebar(); openCustomer(); });
if (cusCancel) cusCancel.addEventListener("click", closeCustomer);
if (customerModal) customerModal.addEventListener("click", (e) => { if (e.target === customerModal) closeCustomer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && customerModal && !customerModal.hidden) closeCustomer(); });
if (cusSubmit) cusSubmit.addEventListener("click", async () => {
  const customerName = cusName.value.trim(), company = cusCompany.value.trim(), contactName = cusContact.value.trim();
  if (!customerName && !company && !contactName) { cusStatus.textContent = "⚠️ Nhập tên khách hàng / công ty / người liên hệ."; cusStatus.style.color = "#ff8a8a"; return; }
  cusSubmit.disabled = true; cusStatus.textContent = "Đang lưu vào CRM Odoo…"; cusStatus.style.color = "var(--muted)";
  try {
    const res = await fetch("/api/crm/lead", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName, company, contactName,
        phone: cusPhone.value.trim() || undefined,
        email: cusEmail.value.trim() || undefined,
        group: cusGroup.value || undefined,
        note: cusNote.value.trim() || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok && d.ok) {
      cusStatus.innerHTML = "✅ Đã lưu khách hàng (lead #" + d.leadId + "). " +
        (d.responsibleName ? "Đã chuyển cho <b>" + escapeHtml(d.responsibleName) + "</b> (Odoo sẽ thông báo/email)." : "<span style='color:#e0a341'>Chưa định tuyến — nhóm này chưa có nhân sự phụ trách.</span>");
      cusStatus.style.color = "#4ade80";
      cusName.value = ""; cusCompany.value = ""; cusContact.value = ""; cusPhone.value = ""; cusEmail.value = ""; cusNote.value = "";
    } else { cusStatus.textContent = "❌ " + (d.error || "Lỗi"); cusStatus.style.color = "#ff8a8a"; }
  } catch (e) { cusStatus.textContent = "❌ " + e.message; cusStatus.style.color = "#ff8a8a"; }
  cusSubmit.disabled = false;
});

/* ---------------- Gọi API chat (stream + dừng + tạo lại) ---------------- */
function setStreaming(on) {
  streaming = on;
  sendBtn.classList.toggle("stop", on);
  sendBtn.textContent = on ? "■" : "↑";
  sendBtn.title = on ? "Dừng" : "Gửi";
}
async function ask(question) {
  lastQuestion = question;
  history.push({ role: "user", content: question });
  const bubble = addMessage("user", question);
  addUserActions(bubble, history.length - 1);
  await streamAnswer();
}
async function regenerate() {
  if (history.length && history[history.length - 1].role === "assistant") history.pop();
  const turns = messagesEl.querySelectorAll(".turn.assistant");
  if (turns.length) turns[turns.length - 1].remove();
  await streamAnswer();
}
async function streamAnswer() {
  const bubble = addMessage("assistant", "");
  bubble.classList.add("typing");
  bubble.textContent = "Đang tra cứu tài liệu…";

  const myController = new AbortController();
  controller = myController;
  // Chủ sở hữu luồng hiện tại: nếu bị thay (vd sửa câu hỏi -> gửi lại) thì luồng cũ
  // KHÔNG được đụng vào trạng thái/ lịch sử chung nữa.
  const mine = () => controller === myController;
  setStreaming(true);
  let answer = "";
  let lastRender = 0;
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history, domain: domainSel.value || undefined, conversationId }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error("Không kết nối được máy chủ");
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let nl;
      while ((nl = buffer.indexOf("\n\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 2);
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5).trim());
        if (event.text) {
          if (!answer) { bubble.classList.remove("typing"); bubble.classList.add("md"); }
          answer += event.text;
          const now = performance.now();
          if (now - lastRender > 60) { bubble.innerHTML = renderMarkdown(answer); lastRender = now; scrollBottom(); }
        } else if (event.tool) {
          // Hiện trạng thái khi Claude đang tra cứu Odoo (chỉ khi chưa có chữ trả lời).
          if (!answer && event.tool.phase !== "error") {
            bubble.classList.add("typing"); bubble.classList.remove("md");
            bubble.textContent = `🔎 Tra cứu Odoo: ${event.tool.summary}…`;
            scrollBottom();
          }
        } else if (event.error) {
          bubble.classList.remove("typing"); bubble.classList.remove("md");
          bubble.textContent = `⚠️ ${event.error}`;
        } else if (event.done) {
          if (answer) { bubble.innerHTML = renderMarkdown(answer); }
          bubble.__md = answer; bubble.__sources = event.sources || [];
          renderSources(bubble, event.sources);
          if (answer) addActions(bubble, event.messageId);
          if (event.conversationId) conversationId = event.conversationId;
          loadConversations(); scrollBottom();
        }
      }
    }
    if (answer && mine()) history.push({ role: "assistant", content: answer });
  } catch (err) {
    if (err.name === "AbortError") {
      // Bị thay bởi luồng mới (sửa câu hỏi) -> bỏ qua, không giữ lại trả lời dở.
      if (!mine()) { /* luồng cũ, không làm gì */ }
      else if (answer) { bubble.innerHTML = renderMarkdown(answer); bubble.__md = answer; bubble.__sources = []; addActions(bubble); history.push({ role: "assistant", content: answer }); }
      else { bubble.closest(".turn")?.remove(); }
    } else {
      bubble.classList.remove("typing", "md");
      bubble.textContent = `⚠️ ${err.message}`;
    }
  } finally {
    if (mine()) { setStreaming(false); controller = null; }
    input.focus();
  }
}

/* ---------------- Sự kiện ---------------- */
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (streaming) { controller?.abort(); return; }
  const q = input.value.trim();
  if (!q) return;
  input.value = ""; input.style.height = "auto";
  closeSidebar();
  ask(q);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!streaming) form.requestSubmit(); }
});
input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; });
newChatBtn.addEventListener("click", () => {
  if (streaming) controller?.abort();
  conversationId = null; history.length = 0;
  renderEmpty(); markActive(); closeSidebar(); input.focus();
});

function openSidebar() { sidebar.classList.add("open"); backdrop.classList.add("show"); }
function closeSidebar() { sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
menuBtn.addEventListener("click", openSidebar);
backdrop.addEventListener("click", closeSidebar);
document.addEventListener("click", () => document.querySelectorAll(".export-menu.open").forEach((m) => m.classList.remove("open")));

/* ---------------- Nền Sáng/Tối ---------------- */
(function initTheme() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  let theme;
  try { theme = localStorage.getItem("theme") || "dark"; } catch { theme = "dark"; }
  const apply = () => {
    document.documentElement.setAttribute("data-theme", theme === "light" ? "light" : "dark");
    btn.textContent = theme === "light" ? "☀️" : "🌙";
  };
  apply();
  btn.addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    try { localStorage.setItem("theme", theme); } catch {}
    apply();
  });
})();

/* ---------------- Khởi động ---------------- */
renderEmpty();
loadMe();
loadConversations();
input.focus();

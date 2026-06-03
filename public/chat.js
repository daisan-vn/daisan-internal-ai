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
  "Cách tạo hóa đơn bán hàng cho khách trong Odoo?",
  "Quy trình nhập kho gồm những bước nào?",
  "Cách tra cứu công nợ phải thu của khách hàng?",
  "SOP duyệt đơn mua hàng ở Daisan?",
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
    '<div class="empty-logo">✦</div>' +
    "<h2>Chào mừng đến Trợ lý AI nội bộ Daisan</h2>" +
    "<p>Hỏi về Odoo, kế toán, SOP, CRM, mua hàng, kho — mình trả lời dựa trên tài liệu nội bộ và luôn kèm nguồn.</p>" +
    '<div class="examples"></div>';
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
function renderFinal(role, content, sources) {
  const bubble = addMessage(role, content);
  if (role === "assistant") {
    bubble.classList.add("md");
    bubble.innerHTML = renderMarkdown(content);
    renderSources(bubble, sources);
    addActions(bubble);
  }
}
function renderSources(bubble, sources) {
  if (!sources || sources.length === 0) return;
  const box = document.createElement("div");
  box.className = "sources";
  box.appendChild(document.createTextNode("Nguồn: "));
  for (const s of sources) {
    const tag = document.createElement("span");
    tag.textContent = s;
    box.appendChild(tag);
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
function addActions(bubble) {
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
  mk("Email", "✉️", () => {
    window.location.href = `mailto:?subject=${encodeURIComponent("Trợ lý AI nội bộ Daisan")}&body=${encodeURIComponent(text())}`;
  });
  mk("Chia sẻ", "🔗", async (b) => {
    const t = text();
    if (navigator.share) { try { await navigator.share({ title: "Trợ lý AI nội bộ Daisan", text: t }); } catch {} }
    else { try { await navigator.clipboard.writeText(t); flash(b, "Đã copy để chia sẻ ✓"); } catch {} }
  });
  bubble.parentElement.appendChild(bar);
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
    for (const m of conv.messages) { history.push({ role: m.role, content: m.content }); renderFinal(m.role, m.content, m.sources); }
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
    const { email } = await res.json();
    if (email && email !== "dev@local") userEmailEl.textContent = email;
  } catch {}
}

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
  addMessage("user", question);
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

  controller = new AbortController();
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
        } else if (event.error) {
          bubble.classList.remove("typing"); bubble.classList.remove("md");
          bubble.textContent = `⚠️ ${event.error}`;
        } else if (event.done) {
          if (answer) { bubble.innerHTML = renderMarkdown(answer); }
          renderSources(bubble, event.sources);
          if (answer) addActions(bubble);
          if (event.conversationId) conversationId = event.conversationId;
          loadConversations(); scrollBottom();
        }
      }
    }
    if (answer) history.push({ role: "assistant", content: answer });
  } catch (err) {
    if (err.name === "AbortError") {
      if (answer) { bubble.innerHTML = renderMarkdown(answer); addActions(bubble); history.push({ role: "assistant", content: answer }); }
      else { bubble.closest(".turn")?.remove(); }
    } else {
      bubble.classList.remove("typing", "md");
      bubble.textContent = `⚠️ ${err.message}`;
    }
  } finally {
    setStreaming(false); controller = null; input.focus();
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

/* ---------------- Khởi động ---------------- */
renderEmpty();
loadMe();
loadConversations();
input.focus();

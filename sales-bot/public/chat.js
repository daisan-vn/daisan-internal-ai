const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const productsPanel = document.getElementById("productsPanel");
const productsGrid = document.getElementById("products");

const site = new URLSearchParams(location.search).get("site") || "daisanstore";
const history = [];
let streaming = false;

function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function vnd(n) { return Math.round(n).toLocaleString("vi-VN") + " ₫"; }
function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

function catIcon(cat) {
  const c = (cat || "").toLowerCase();
  if (c.includes("gạch")) return "🧱";
  if (c.includes("sơn")) return "🎨";
  if (c.includes("xi")) return "🏗️";
  if (c.includes("thạch")) return "🧰";
  if (c.includes("thép") || c.includes("sắt")) return "🔩";
  return "📦";
}

/* ---------- Tin nhắn ---------- */
function turn(role) {
  const t = document.createElement("div");
  t.className = "sb-turn " + role;
  messagesEl.appendChild(t);
  return t;
}
function bubble(role, html) {
  const t = turn(role);
  const b = document.createElement("div");
  b.className = "sb-bubble";
  b.innerHTML = html;
  t.appendChild(b);
  scrollBottom();
  return b;
}
function renderText(s) { return esc(s).replace(/\*\*([^*]+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); }

/* ---------- Thẻ sản phẩm (kiểu Tiki) ---------- */
function productCard(p) {
  const card = document.createElement("div");
  card.className = "sb-card";
  const img = p.image
    ? `<div class="sb-card-img"><img src="${esc(p.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=&quot;sb-ph&quot;>${catIcon(p.category)}</span>'"></div>`
    : `<div class="sb-card-img"><span class="sb-ph">${catIcon(p.category)}</span></div>`;
  const price = p.price
    ? `<div class="sb-card-price">${vnd(p.price)}${p.unit ? `<span>/${esc(p.unit)}</span>` : ""}</div>`
    : `<div class="sb-card-price contact">Liên hệ báo giá</div>`;
  card.innerHTML =
    img +
    `<div class="sb-card-body">` +
    `<div class="sb-card-name" title="${esc(p.name)}">${esc(p.name)}</div>` +
    price +
    (p.brand ? `<div class="sb-card-brand">${esc(p.brand)}</div>` : "") +
    `<button class="sb-card-btn" type="button">Tư vấn ngay</button>` +
    `</div>`;
  card.querySelector(".sb-card-btn").addEventListener("click", () => {
    if (!streaming) send("Tôi quan tâm sản phẩm: " + p.name + ". Tư vấn giúp tôi.");
  });
  return card;
}

// Màn rộng -> hiện sản phẩm ở CỘT PHẢI; màn hẹp/widget -> hiện trong khung chat.
function isWide() { return window.matchMedia("(min-width: 760px)").matches; }

function renderProducts(products) {
  if (isWide() && productsGrid) {
    productsGrid.innerHTML = "";
    products.forEach((p) => productsGrid.appendChild(productCard(p)));
    bubble("bot", `👉 Em đã hiển thị <b>${products.length}</b> sản phẩm ở cột bên phải, anh/chị xem giúp em nhé.`);
  } else {
    const t = turn("bot");
    const row = document.createElement("div");
    row.className = "sb-cards";
    products.forEach((p) => row.appendChild(productCard(p)));
    t.appendChild(row);
    scrollBottom();
  }
}

/* ---------- Thẻ cửa hàng gần nhất ---------- */
function renderStores(stores) {
  const t = turn("bot");
  const wrap = document.createElement("div");
  wrap.className = "sb-stores";
  stores.forEach((s) => {
    const el = document.createElement("div");
    el.className = "sb-store";
    el.innerHTML =
      `<div class="sb-store-top"><span class="sb-store-name">📍 ${esc(s.name)}</span>` +
      (s.distanceKm != null ? `<span class="sb-badge">${s.distanceKm} km</span>` : "") + `</div>` +
      `<div class="sb-store-addr">${esc(s.address || s.province || "")}</div>` +
      (s.phone ? `<a class="sb-store-phone" href="tel:${esc(s.phone)}">📞 ${esc(s.phone)}</a>` : "");
    wrap.appendChild(el);
  });
  t.appendChild(wrap);
  scrollBottom();
}

/* ---------- Chip gợi ý ---------- */
function renderChips(items) {
  const t = turn("bot");
  const row = document.createElement("div");
  row.className = "sb-chips";
  items.forEach((q) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "sb-chip"; b.textContent = q;
    b.addEventListener("click", () => { if (!streaming) send(q); });
    row.appendChild(b);
  });
  t.appendChild(row);
  scrollBottom();
}

/* ---------- Lời chào ---------- */
bubble("bot", "Chào anh/chị 👋 Em là trợ lý của <b>Daisan</b>. Anh/chị cần vật liệu gì, ở khu vực nào ạ? Em tư vấn và tìm cửa hàng gần nhất giúp mình.");
renderChips(["Gạch ốp lát 60x60", "Sơn nước ngoại thất", "Xi măng", "Cửa hàng gần Hà Nội"]);

/* ---------- Gửi & nhận stream ---------- */
async function send(text) {
  history.push({ role: "user", content: text });
  bubble("user", renderText(text));

  const status = turn("bot");
  const pill = document.createElement("div");
  pill.className = "sb-bubble sb-typing";
  pill.textContent = "Đang soạn…";
  status.appendChild(pill);
  let statusAlive = true;
  const clearStatus = () => { if (statusAlive) { status.remove(); statusAlive = false; } };

  let botEl = null;
  let answer = "";
  streaming = true; sendBtn.disabled = true;
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history, site }),
    });
    if (!res.ok || !res.body) throw new Error("Không kết nối được máy chủ");
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 2);
        if (!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.text) {
          clearStatus();
          if (!botEl) botEl = bubble("bot", "");
          answer += ev.text; botEl.innerHTML = renderText(answer); scrollBottom();
        } else if (ev.products) { clearStatus(); renderProducts(ev.products); }
        else if (ev.stores) { clearStatus(); renderStores(ev.stores); }
        else if (ev.tool && statusAlive) { pill.textContent = "🔎 " + ev.tool.summary + "…"; }
        else if (ev.error) { clearStatus(); bubble("bot", "⚠️ " + esc(ev.error)); }
      }
    }
    if (answer) history.push({ role: "assistant", content: answer });
  } catch (e) {
    clearStatus(); bubble("bot", "⚠️ " + esc(e.message));
  } finally {
    clearStatus(); streaming = false; sendBtn.disabled = false; input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t || streaming) return;
  input.value = "";
  send(t);
});
input.focus();

const fileInput = document.getElementById("file");
const drop = document.getElementById("drop");
const fname = document.getElementById("fname");
const upBtn = document.getElementById("up");
const folderSel = document.getElementById("folder");
const statusEl = document.getElementById("status");
const docsEl = document.getElementById("docs");
const emptyEl = document.getElementById("empty");
let selected = null;

function fmtSize(b) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + " MB";
  if (b > 1024) return (b / 1024).toFixed(0) + " KB";
  return b + " B";
}
function setFile(f) {
  selected = f;
  fname.textContent = "Đã chọn: " + f.name + " (" + fmtSize(f.size) + ")";
  upBtn.disabled = false;
}

drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
fileInput.addEventListener("change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });

upBtn.addEventListener("click", async () => {
  if (!selected) return;
  upBtn.disabled = true;
  statusEl.textContent = "Đang tải lên…"; statusEl.style.color = "var(--muted)";
  const fd = new FormData();
  fd.append("file", selected);
  fd.append("folder", folderSel.value);
  try {
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (res.ok) {
      statusEl.textContent = "✅ Đã tải lên: " + j.key; statusEl.style.color = "#4ade80";
      selected = null; fname.textContent = ""; fileInput.value = "";
      loadDocs();
    } else { statusEl.textContent = "❌ " + (j.error || "Lỗi"); statusEl.style.color = "#ff8a8a"; }
  } catch (e) { statusEl.textContent = "❌ " + e.message; statusEl.style.color = "#ff8a8a"; }
  upBtn.disabled = false;
});

async function loadDocs() {
  try {
    const res = await fetch("/api/admin/docs");
    const { objects } = await res.json();
    docsEl.innerHTML = "";
    emptyEl.style.display = objects.length ? "none" : "block";
    for (const o of objects) {
      const parts = o.key.split("/");
      const folder = parts.length > 1 ? parts[0] : "—";
      const name = parts[parts.length - 1];
      const tr = document.createElement("tr");
      const c1 = document.createElement("td"); c1.textContent = name;
      const c2 = document.createElement("td"); c2.textContent = folder;
      const c3 = document.createElement("td"); c3.textContent = fmtSize(o.size);
      const c4 = document.createElement("td");
      const del = document.createElement("button");
      del.className = "del"; del.textContent = "Xóa";
      del.addEventListener("click", async () => {
        if (!confirm("Xóa tài liệu này khỏi kho?")) return;
        try { await fetch("/api/admin/docs?key=" + encodeURIComponent(o.key), { method: "DELETE" }); } catch {}
        loadDocs();
      });
      c4.appendChild(del);
      tr.append(c1, c2, c3, c4);
      docsEl.appendChild(tr);
    }
  } catch {}
}
loadDocs();

/* Nền Sáng/Tối */
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

/* ===================== Tabs + Lịch sử đăng nhập ===================== */
const tabBtns = document.querySelectorAll(".tab");
const tabAccessBtn = document.getElementById("tabAccessBtn");
const tabStatsBtn = document.getElementById("tabStatsBtn");
const tabGrantsBtn = document.getElementById("tabGrantsBtn");
const tabReportsBtn = document.getElementById("tabReportsBtn");
const tabAlertsBtn = document.getElementById("tabAlertsBtn");
const sectionByTab = {
  docs: document.getElementById("tab-docs"),
  stats: document.getElementById("tab-stats"),
  reports: document.getElementById("tab-reports"),
  alerts: document.getElementById("tab-alerts"),
  grants: document.getElementById("tab-grants"),
  access: document.getElementById("tab-access"),
};
let accessLoaded = false, statsLoaded = false, grantsLoaded = false, reportsLoaded = false, alertsLoaded = false;

tabBtns.forEach((t) => t.addEventListener("click", () => {
  const name = t.dataset.tab;
  tabBtns.forEach((x) => x.classList.toggle("active", x === t));
  for (const k in sectionByTab) if (sectionByTab[k]) sectionByTab[k].hidden = k !== name;
  if (name === "access" && !accessLoaded) { accessLoaded = true; loadAccess(); }
  if (name === "stats" && !statsLoaded) { statsLoaded = true; loadStats(); }
  if (name === "grants" && !grantsLoaded) { grantsLoaded = true; loadGrants(); }
  if (name === "reports" && !reportsLoaded) { reportsLoaded = true; loadReports(); }
  if (name === "alerts" && !alertsLoaded) { alertsLoaded = true; loadAlerts(); }
}));

// Ẩn các tab quản trị nếu không phải quản trị viên.
(async () => {
  try {
    const me = await (await fetch("/api/me")).json();
    if (me && me.isAdmin === false) {
      if (tabAccessBtn) tabAccessBtn.style.display = "none";
      if (tabStatsBtn) tabStatsBtn.style.display = "none";
      if (tabGrantsBtn) tabGrantsBtn.style.display = "none";
      if (tabReportsBtn) tabReportsBtn.style.display = "none";
      if (tabAlertsBtn) tabAlertsBtn.style.display = "none";
    }
  } catch {}
})();

/* ===================== Cảnh báo giám sát ===================== */
const alBody = document.getElementById("alBody");
const alTime = document.getElementById("alTime");
const alRun = document.getElementById("alRun");
const alStatus = document.getElementById("alStatus");

function fmtVnd(n) { return Math.round(n || 0).toLocaleString("vi-VN") + " ₫"; }
function sevAttr(n) { return n > 0 ? 'style="color:#ff8a8a;font-weight:700"' : 'style="color:#4ade80;font-weight:700"'; }

function renderAlerts(r) {
  if (!r) { alBody.innerHTML = '<div class="card2"><p class="note">Chưa có lần kiểm tra nào. Bấm "Kiểm tra ngay".</p></div>'; return; }
  if (r.generated_at) alTime.textContent = "Lần kiểm tra gần nhất: " + fmtTime(r.generated_at);
  let h = "";

  const rc = r.receivable || {};
  h += '<div class="card2"><h2>💰 Công nợ phải thu quá hạn</h2>';
  if (!rc.ok) h += '<p class="note">⚠️ Không kiểm tra được: ' + esc(rc.error || "") + "</p>";
  else {
    h += "<p>Số dòng quá hạn: <span " + sevAttr(rc.count) + ">" + (rc.count || 0) + "</span> · Tổng quá hạn: <b>" + fmtVnd(rc.total) + "</b></p>";
    if (rc.top && rc.top.length) h += "<table><thead><tr><th>Khách hàng</th><th>Số tiền quá hạn</th></tr></thead><tbody>" + rc.top.map((t) => "<tr><td>" + esc(t.partner) + "</td><td>" + fmtVnd(t.amount) + "</td></tr>").join("") + "</tbody></table>";
  }
  h += "</div>";

  const ns = r.negativeStock || {};
  h += '<div class="card2"><h2>📦 Tồn kho âm</h2>';
  if (!ns.ok) h += '<p class="note">⚠️ Không kiểm tra được: ' + esc(ns.error || "") + "</p>";
  else {
    h += "<p>Số dòng tồn âm: <span " + sevAttr(ns.count) + ">" + (ns.count || 0) + "</span></p>";
    if (ns.items && ns.items.length) h += "<table><thead><tr><th>Sản phẩm</th><th>Kho</th><th>Số lượng</th></tr></thead><tbody>" + ns.items.map((t) => '<tr><td>' + esc(t.product) + "</td><td>" + esc(t.location) + '</td><td style="color:#ff8a8a">' + t.qty + "</td></tr>").join("") + "</tbody></table>";
  }
  h += "</div>";

  const ur = r.unreconciled || {};
  h += '<div class="card2"><h2>🏦 Quỹ tiền / ngân hàng chưa đối chiếu</h2>';
  if (!ur.ok) h += '<p class="note">⚠️ Không kiểm tra được: ' + esc(ur.error || "") + "</p>";
  else {
    h += "<p>Số dòng chưa đối chiếu: <span " + sevAttr(ur.count) + ">" + (ur.count || 0) + "</span> · Tổng: <b>" + fmtVnd(ur.total) + "</b></p>";
    if (ur.items && ur.items.length) h += "<table><thead><tr><th>Ngày</th><th>Diễn giải</th><th>Sổ quỹ/NH</th><th>Số tiền</th></tr></thead><tbody>" + ur.items.slice(0, 30).map((t) => "<tr><td>" + esc(t.date || "") + "</td><td>" + esc(t.ref) + "</td><td>" + esc(t.journal) + "</td><td>" + fmtVnd(t.amount) + "</td></tr>").join("") + "</tbody></table>";
  }
  h += "</div>";

  alBody.innerHTML = h;
}

async function loadAlerts() {
  const allowed = document.getElementById("alertsAllowed");
  const denied = document.getElementById("alertsDenied");
  try {
    const res = await fetch("/api/admin/alerts");
    if (res.status === 403) { if (allowed) allowed.style.display = "none"; if (denied) denied.hidden = false; return; }
    if (allowed) allowed.style.display = ""; if (denied) denied.hidden = true;
    const d = await res.json();
    renderAlerts(d.latest);
  } catch {}
}

const alEmailTest = document.getElementById("alEmailTest");
if (alEmailTest) alEmailTest.addEventListener("click", async () => {
  alEmailTest.disabled = true;
  alStatus.textContent = "✉️ Đang gửi email thử…"; alStatus.style.color = "var(--muted)";
  try {
    const d = await (await fetch("/api/admin/email-test", { method: "POST" })).json();
    if (d.ok) { alStatus.textContent = "✅ Đã gửi email thử — kiểm tra hộp thư người nhận."; alStatus.style.color = "#4ade80"; }
    else { alStatus.textContent = "❌ " + (d.error || "Lỗi"); alStatus.style.color = "#ff8a8a"; }
  } catch (e) { alStatus.textContent = "❌ " + e.message; alStatus.style.color = "#ff8a8a"; }
  alEmailTest.disabled = false;
});

if (alRun) alRun.addEventListener("click", async () => {
  alRun.disabled = true;
  alStatus.textContent = "⏳ Đang kiểm tra dữ liệu Odoo…";
  alStatus.style.color = "var(--muted)";
  try {
    const d = await (await fetch("/api/admin/alerts", { method: "POST" })).json();
    renderAlerts(d.result);
    alStatus.textContent = "✅ Đã kiểm tra xong.";
    alStatus.style.color = "#4ade80";
  } catch (e) {
    alStatus.textContent = "❌ " + e.message; alStatus.style.color = "#ff8a8a";
  }
  alRun.disabled = false;
});

/* ===================== Báo cáo tự động ===================== */
const repRows = document.getElementById("repRows");
const repEmpty = document.getElementById("repEmpty");
const repView = document.getElementById("repView");
const repViewTitle = document.getElementById("repViewTitle");
const repGen = document.getElementById("repGen");
const repStatus = document.getElementById("repStatus");
let repNewestAt = 0;

function inl(s) { return s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>"); }
function mdLite(md) {
  const lines = esc(md || "").replace(/\r\n/g, "\n").split("\n");
  let html = "", i = 0;
  const cells = (r) => r.replace(/^\s*\|?/, "").replace(/\|?\s*$/, "").split("|").map((c) => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lv = Math.min(h[1].length + 2, 6); html += "<h" + lv + ">" + inl(h[2]) + "</h" + lv + ">"; i++; continue; }
    if (l.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(l); i += 2; let rows = "";
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows += "<tr>" + cells(lines[i]).map((c) => "<td>" + inl(c) + "</td>").join("") + "</tr>"; i++; }
      html += "<table><thead><tr>" + head.map((c) => "<th>" + inl(c) + "</th>").join("") + "</tr></thead><tbody>" + rows + "</tbody></table>"; continue;
    }
    if (/^\s*[-*]\s+/.test(l)) { let it = ""; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) it += "<li>" + inl(lines[i++].replace(/^\s*[-*]\s+/, "")) + "</li>"; html += "<ul>" + it + "</ul>"; continue; }
    const buf = [l]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*[-*]\s|\|)/.test(lines[i])) buf.push(lines[i++]);
    html += "<p>" + inl(buf.join("<br>")) + "</p>";
  }
  return html;
}

async function loadReports() {
  const allowed = document.getElementById("reportsAllowed");
  const denied = document.getElementById("reportsDenied");
  try {
    const res = await fetch("/api/admin/reports");
    if (res.status === 403) { if (allowed) allowed.style.display = "none"; if (denied) denied.hidden = false; return; }
    if (allowed) allowed.style.display = ""; if (denied) denied.hidden = true;
    const { reports } = await res.json();
    repEmpty.style.display = reports.length ? "none" : "block";
    repNewestAt = reports.length ? reports[0].created_at : 0;
    repRows.innerHTML = "";
    for (const r of reports) {
      const tr = document.createElement("tr");
      tr.className = "rep-item";
      tr.innerHTML = "<td>" + esc(r.title || ("Báo cáo " + r.kind)) + "</td><td>" + fmtTime(r.created_at) + "</td>";
      tr.addEventListener("click", () => viewReport(r.id));
      repRows.appendChild(tr);
    }
    if (reports.length && repView.dataset.loaded !== "1") viewReport(reports[0].id);
  } catch {}
}

async function viewReport(id) {
  try {
    const r = await (await fetch("/api/admin/reports/" + encodeURIComponent(id))).json();
    repViewTitle.textContent = r.title || "Nội dung";
    repView.innerHTML = mdLite(r.content || "");
    repView.dataset.loaded = "1";
  } catch {}
}

if (repGen) repGen.addEventListener("click", async () => {
  repGen.disabled = true;
  repStatus.textContent = "⏳ Đang tạo báo cáo (truy vấn Odoo)… có thể mất ~30 giây.";
  repStatus.style.color = "var(--muted)";
  const before = repNewestAt;
  try {
    await fetch("/api/admin/reports", { method: "POST" });
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      await loadReports();
      if (repNewestAt > before) {
        clearInterval(poll);
        repStatus.textContent = "✅ Đã tạo báo cáo mới.";
        repStatus.style.color = "#4ade80";
        repGen.disabled = false;
      } else if (tries >= 15) {
        clearInterval(poll);
        repStatus.textContent = "Báo cáo đang chạy lâu hơn dự kiến — bấm tab Báo cáo lại sau ít phút để xem.";
        repGen.disabled = false;
      }
    }, 4000);
  } catch (e) {
    repStatus.textContent = "❌ " + e.message; repStatus.style.color = "#ff8a8a"; repGen.disabled = false;
  }
});

/* ===================== Phân quyền phòng ban ===================== */
const grEmail = document.getElementById("grEmail");
const grChecks = document.getElementById("grChecks");
const grSave = document.getElementById("grSave");
const grStatus = document.getElementById("grStatus");
const grRows = document.getElementById("grRows");
const grEmpty = document.getElementById("grEmpty");
const grRestricted = document.getElementById("grRestricted");
let grRestrictedList = [];
let grLabels = {};

async function loadGrants() {
  const allowed = document.getElementById("grantsAllowed");
  const denied = document.getElementById("grantsDenied");
  try {
    const res = await fetch("/api/admin/grants");
    if (res.status === 403) { if (allowed) allowed.style.display = "none"; if (denied) denied.hidden = false; return; }
    if (allowed) allowed.style.display = ""; if (denied) denied.hidden = true;
    const d = await res.json();
    grRestrictedList = d.restricted || [];
    grLabels = d.labels || {};

    grRestricted.innerHTML = grRestrictedList.length
      ? "Phòng hạn chế hiện tại: " + grRestrictedList.map((x) => "🔒 <b>" + esc(grLabels[x] || x) + "</b>").join(" · ")
      : "<i>Chưa cấu hình phòng hạn chế nào (RESTRICTED_DEPTS trống) — mọi phòng đang mở.</i>";

    grChecks.innerHTML = grRestrictedList
      .map((x) => '<label class="note" style="display:flex;align-items:center;gap:5px"><input type="checkbox" class="grck" value="' + x + '"> ' + esc(grLabels[x] || x) + "</label>")
      .join("") || '<span class="note">(không có phòng hạn chế)</span>';

    const grants = d.grants || [];
    grEmpty.style.display = grants.length ? "none" : "block";
    grRows.innerHTML = "";
    for (const g of grants) {
      const tr = document.createElement("tr");
      const badges = (g.depts || []).map((x) => '<span style="background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:2px 8px;margin-right:4px;font-size:12px">' + esc(grLabels[x] || x) + "</span>").join("");
      tr.innerHTML = "<td>" + esc(g.user_email) + "</td><td>" + (badges || "—") + "</td>";
      const td = document.createElement("td");
      const edit = document.createElement("button");
      edit.className = "del"; edit.textContent = "Sửa";
      edit.addEventListener("click", () => {
        grEmail.value = g.user_email;
        grChecks.querySelectorAll(".grck").forEach((c) => { c.checked = (g.depts || []).includes(c.value); });
        grEmail.focus();
      });
      td.appendChild(edit); tr.appendChild(td);
      grRows.appendChild(tr);
    }
  } catch {}
}

if (grSave) grSave.addEventListener("click", async () => {
  const email = (grEmail.value || "").trim().toLowerCase();
  if (!email) { grStatus.textContent = "⚠️ Nhập email trước."; grStatus.style.color = "#ff8a8a"; return; }
  grSave.disabled = true; grStatus.textContent = "Đang lưu…"; grStatus.style.color = "var(--muted)";
  try {
    const checks = [...grChecks.querySelectorAll(".grck")];
    for (const c of checks) {
      await fetch("/api/admin/grants", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, dept: c.value, on: c.checked }),
      });
    }
    grStatus.textContent = "✅ Đã lưu quyền cho " + email; grStatus.style.color = "#4ade80";
    grEmail.value = ""; checks.forEach((c) => (c.checked = false));
    loadGrants();
  } catch (e) { grStatus.textContent = "❌ " + e.message; grStatus.style.color = "#ff8a8a"; }
  grSave.disabled = false;
});

const accStats = document.getElementById("accStats");
const accRows = document.getElementById("accRows");
const accEmpty = document.getElementById("accEmpty");
const accAllowed = document.getElementById("accAllowed");
const accDenied = document.getElementById("accDenied");
const accSearch = document.getElementById("accSearch");
const accRange = document.getElementById("accRange");
const accRefresh = document.getElementById("accRefresh");
let accData = [];

function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fmtTime(ts) { return ts ? new Date(ts).toLocaleString("vi-VN") : "—"; }
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return Math.floor(s / 60) + " phút trước";
  if (s < 86400) return Math.floor(s / 3600) + " giờ trước";
  return Math.floor(s / 86400) + " ngày trước";
}
function deviceFromUA(ua) {
  ua = ua || "";
  let os = "Khác";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad/i.test(ua)) os = "iOS";
  else if (/Macintosh|Mac OS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";
  let br = "";
  if (/Edg\//i.test(ua)) br = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) br = "Opera";
  else if (/Chrome\//i.test(ua)) br = "Chrome";
  else if (/Firefox\//i.test(ua)) br = "Firefox";
  else if (/Safari\//i.test(ua)) br = "Safari";
  return br ? os + " · " + br : os;
}

async function loadAccess() {
  try {
    const res = await fetch("/api/admin/access?days=" + encodeURIComponent(accRange ? accRange.value : "7"));
    if (res.status === 403) {
      if (accAllowed) accAllowed.style.display = "none";
      if (accDenied) accDenied.hidden = false;
      return;
    }
    if (accAllowed) accAllowed.style.display = "";
    if (accDenied) accDenied.hidden = true;
    const data = await res.json();
    accData = data.sessions || [];
    renderStats(data.stats || {});
    renderAccess();
  } catch {}
}
function renderStats(s) {
  const card = (v, l) => '<div class="stat"><div class="v">' + (v || 0) + '</div><div class="l">' + l + "</div></div>";
  accStats.innerHTML =
    card(s.users, "Người dùng") +
    card(s.online, "Đang hoạt động") +
    card(s.today, "Phiên 24h qua") +
    card(s.total, "Tổng phiên");
}
function renderAccess() {
  const q = (accSearch ? accSearch.value : "").trim().toLowerCase();
  const rows = accData.filter((r) => !q || (r.user_email || "").toLowerCase().includes(q));
  accRows.innerHTML = "";
  accEmpty.style.display = rows.length ? "none" : "block";
  const now = Date.now();
  for (const r of rows) {
    const online = now - r.last_seen_at < 5 * 60 * 1000;
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + (online ? '<span class="badge-on" title="Đang hoạt động"></span>' : "") + esc(r.user_email) + "</td>" +
      "<td>" + fmtTime(r.started_at) + "</td>" +
      "<td>" + ago(r.last_seen_at) + "</td>" +
      '<td class="mono">' + esc(r.ip || "—") + "</td>" +
      "<td>" + esc(r.country || "—") + "</td>" +
      "<td>" + esc(deviceFromUA(r.user_agent)) + "</td>" +
      "<td>" + (r.hits || 1) + "</td>";
    accRows.appendChild(tr);
  }
}
if (accRefresh) accRefresh.addEventListener("click", loadAccess);
if (accRange) accRange.addEventListener("change", loadAccess);
if (accSearch) accSearch.addEventListener("input", renderAccess);

/* ===================== Thống kê ===================== */
const stRange = document.getElementById("stRange");
const stRefresh = document.getElementById("stRefresh");

async function loadStats() {
  const allowed = document.getElementById("statsAllowed");
  const denied = document.getElementById("statsDenied");
  try {
    const res = await fetch("/api/admin/stats?days=" + encodeURIComponent(stRange ? stRange.value : "30"));
    if (res.status === 403) {
      if (allowed) allowed.style.display = "none";
      if (denied) denied.hidden = false;
      return;
    }
    if (allowed) allowed.style.display = "";
    if (denied) denied.hidden = true;
    const d = await res.json();
    const s = d.stats || {};
    const card = (v, l) => '<div class="stat"><div class="v">' + (v || 0) + '</div><div class="l">' + l + "</div></div>";
    document.getElementById("stStats").innerHTML =
      card(s.questions, "Câu hỏi") +
      card(s.users, "Người dùng") +
      card(s.unknown, "Chưa trả lời được") +
      card("👍 " + (s.up || 0), "Hữu ích") +
      card("👎 " + (s.down || 0), "Chưa tốt");

    const gaps = d.gaps || [];
    document.getElementById("stGapsEmpty").style.display = gaps.length ? "none" : "block";
    document.getElementById("stGaps").innerHTML = gaps
      .map((g) => "<tr><td>" + esc(g.question) + "</td><td>" + esc(g.user_email) + "</td><td>" + fmtTime(g.created_at) + "</td></tr>")
      .join("");

    const top = d.top || [];
    document.getElementById("stTopEmpty").style.display = top.length ? "none" : "block";
    document.getElementById("stTop").innerHTML = top
      .map((t) => "<tr><td>" + esc(t.question) + "</td><td>" + (t.count || 1) + "</td><td>" + fmtTime(t.last) + "</td></tr>")
      .join("");

    const disliked = d.disliked || [];
    document.getElementById("stDislikedEmpty").style.display = disliked.length ? "none" : "block";
    document.getElementById("stDisliked").innerHTML = disliked
      .map((x) => "<tr><td>" + esc(x.question) + "</td><td class='note' style='max-width:340px'>" + esc(x.answer) + "…</td><td>" + esc(x.user_email) + "</td><td>" + fmtTime(x.created_at) + "</td></tr>")
      .join("");
  } catch {}
}
if (stRange) stRange.addEventListener("change", loadStats);
if (stRefresh) stRefresh.addEventListener("click", loadStats);

/* ===================== Đồng bộ Google Drive ===================== */
const gdriveCard = document.getElementById("gdriveCard");
const gdriveState = document.getElementById("gdriveState");
const gdriveStatusEl = document.getElementById("gdriveStatus");
const gdriveSyncBtn = document.getElementById("gdriveSync");
let gdrivePoll = null;

function renderSyncStatus(d) {
  const st = (d && d.status) || {};
  if (!d || !d.configured) {
    gdriveState.innerHTML = "⚠️ <b>Chưa kết nối Google Drive.</b> Cần cấu hình service account + ID thư mục (xem hướng dẫn). Khi xong, nút bên dưới sẽ hoạt động.";
    if (gdriveSyncBtn) gdriveSyncBtn.disabled = true;
    return;
  }
  if (gdriveSyncBtn) gdriveSyncBtn.disabled = st.state === "running";
  if (st.state === "running") {
    gdriveState.textContent = "⏳ Đang đồng bộ tài liệu từ Google Drive…";
  } else if (st.state === "done" && st.summary) {
    let s = {};
    try { s = JSON.parse(st.summary); } catch {}
    gdriveState.textContent =
      "✅ Lần đồng bộ gần nhất: +" + (s.added || 0) + " mới, " + (s.updated || 0) + " cập nhật, " +
      (s.skipped || 0) + " bỏ qua" + (s.errors && s.errors.length ? ", " + s.errors.length + " lỗi" : "") +
      (st.finished_at ? " · " + fmtTime(st.finished_at) : "") +
      (s.truncated ? " (còn file chưa xong — sẽ tiếp tục lần sau)" : "");
  } else if (st.state === "error") {
    gdriveState.textContent = "❌ Lỗi đồng bộ: " + (st.error || "") + (st.finished_at ? " · " + fmtTime(st.finished_at) : "");
  } else {
    gdriveState.textContent = "✅ Đã kết nối Google Drive. Chưa đồng bộ lần nào — bấm \"Đồng bộ ngay\".";
  }
}

async function loadSyncStatus() {
  try {
    const res = await fetch("/api/admin/sync-drive");
    if (res.status === 403) { if (gdriveCard) gdriveCard.style.display = "none"; return; }
    const d = await res.json();
    renderSyncStatus(d);
    const running = d && d.status && d.status.state === "running";
    if (running && !gdrivePoll) gdrivePoll = setInterval(loadSyncStatus, 3000);
    if (!running && gdrivePoll) {
      clearInterval(gdrivePoll); gdrivePoll = null;
      if (typeof loadDocs === "function") loadDocs(); // làm mới danh sách tài liệu khi đồng bộ xong
    }
  } catch {}
}

if (gdriveSyncBtn) gdriveSyncBtn.addEventListener("click", async () => {
  gdriveSyncBtn.disabled = true;
  gdriveStatusEl.textContent = "Đang khởi động…";
  try {
    const r = await fetch("/api/admin/sync-drive", { method: "POST" });
    const j = await r.json();
    if (!r.ok) { gdriveStatusEl.textContent = "❌ " + (j.error || "Lỗi"); gdriveSyncBtn.disabled = false; return; }
    gdriveStatusEl.textContent = "";
    if (!gdrivePoll) gdrivePoll = setInterval(loadSyncStatus, 3000);
    loadSyncStatus();
  } catch (e) { gdriveStatusEl.textContent = "❌ " + e.message; gdriveSyncBtn.disabled = false; }
});
loadSyncStatus();

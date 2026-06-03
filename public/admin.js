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

/* ===================== Tabs + Lịch sử đăng nhập ===================== */
const tabBtns = document.querySelectorAll(".tab");
const tabDocs = document.getElementById("tab-docs");
const tabAccess = document.getElementById("tab-access");
const tabAccessBtn = document.getElementById("tabAccessBtn");
let accessLoaded = false;

tabBtns.forEach((t) => t.addEventListener("click", () => {
  tabBtns.forEach((x) => x.classList.toggle("active", x === t));
  const isAccess = t.dataset.tab === "access";
  tabDocs.hidden = isAccess;
  tabAccess.hidden = !isAccess;
  if (isAccess && !accessLoaded) { accessLoaded = true; loadAccess(); }
}));

// Ẩn tab "Lịch sử đăng nhập" nếu không phải quản trị viên.
(async () => {
  try {
    const me = await (await fetch("/api/me")).json();
    if (me && me.isAdmin === false && tabAccessBtn) tabAccessBtn.style.display = "none";
  } catch {}
})();

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
    if (!running && gdrivePoll) { clearInterval(gdrivePoll); gdrivePoll = null; }
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

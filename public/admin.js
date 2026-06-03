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

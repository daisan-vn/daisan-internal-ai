const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

// Site (daisanstore | b2b | daisan) — truyền từ widget qua query ?site=
const site = new URLSearchParams(location.search).get("site") || "daisanstore";
const history = [];
let streaming = false;

function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function bubble(role, text) {
  const el = document.createElement("div");
  el.className = "sb-msg " + role;
  el.innerHTML = esc(text).replace(/\n/g, "<br>");
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

// Lời chào
bubble("bot", "Chào anh/chị 👋 Em là trợ lý của Daisan. Anh/chị đang cần vật liệu gì, ở khu vực nào ạ? Em tư vấn và tìm cửa hàng gần nhất giúp mình.");

async function send(text) {
  history.push({ role: "user", content: text });
  bubble("user", text);
  const el = bubble("bot", "");
  el.classList.add("typing");
  el.textContent = "Đang soạn…";
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
        if (ev.text) { el.classList.remove("typing"); answer += ev.text; el.innerHTML = esc(answer).replace(/\n/g, "<br>"); messagesEl.scrollTop = messagesEl.scrollHeight; }
        else if (ev.tool && !answer) { el.textContent = "🔎 " + ev.tool.summary + "…"; }
        else if (ev.error) { el.classList.remove("typing"); el.textContent = "⚠️ " + ev.error; }
      }
    }
    if (answer) history.push({ role: "assistant", content: answer });
  } catch (e) {
    el.classList.remove("typing"); el.textContent = "⚠️ " + e.message;
  } finally {
    streaming = false; sendBtn.disabled = false; input.focus();
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

const messagesEl = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const domainSel = document.getElementById("domain");

// Lịch sử hội thoại gửi kèm mỗi request (Phase 1: chỉ giữ ở client).
const history = [];

function addMessage(role, text) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
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

async function ask(question) {
  history.push({ role: "user", content: question });
  addMessage("user", question);

  const bubble = addMessage("assistant", "");
  bubble.classList.add("typing");
  bubble.textContent = "Đang tra cứu tài liệu…";

  let answer = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history, domain: domainSel.value || undefined }),
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
          bubble.classList.remove("typing");
          answer += event.text;
          bubble.textContent = answer;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else if (event.error) {
          bubble.classList.remove("typing");
          bubble.textContent = `⚠️ ${event.error}`;
        } else if (event.done) {
          renderSources(bubble, event.sources);
        }
      }
    }
    if (answer) history.push({ role: "assistant", content: answer });
  } catch (err) {
    bubble.classList.remove("typing");
    bubble.textContent = `⚠️ ${err.message}`;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  input.style.height = "auto";
  sendBtn.disabled = true;
  ask(q).finally(() => {
    sendBtn.disabled = false;
    input.focus();
  });
});

// Enter để gửi, Shift+Enter xuống dòng. Tự co giãn ô nhập.
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
});

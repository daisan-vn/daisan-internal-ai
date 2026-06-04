/**
 * Widget nhúng chatbot bán hàng Daisan. Chèn 1 dòng vào website:
 *   <script src="https://<worker-url>/widget.js" data-site="daisanstore" defer></script>
 * Nó tạo bong bóng chat + khung iframe trỏ về Worker (chat UI). Vì iframe cùng
 * nguồn với Worker nên gọi /api/chat không vướng CORS.
 */
(function () {
  var script = document.currentScript;
  var origin = new URL(script.src).origin;
  var site = script.getAttribute("data-site") || "daisanstore";

  var css =
    "#dsb-bubble{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;" +
    "background:linear-gradient(135deg,#e11d2a,#f0883e);color:#fff;font-size:26px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:2147483000;}" +
    "#dsb-panel{position:fixed;right:20px;bottom:90px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 120px);" +
    "border:none;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.3);z-index:2147483000;display:none;overflow:hidden;background:#fff;}" +
    "#dsb-panel.dsb-open{display:block;}" +
    "@media(max-width:480px){#dsb-panel{right:8px;left:8px;width:auto;bottom:84px;}}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var iframe = document.createElement("iframe");
  iframe.id = "dsb-panel";
  iframe.title = "Tư vấn Daisan";
  iframe.src = origin + "/?embed=1&site=" + encodeURIComponent(site);

  var btn = document.createElement("button");
  btn.id = "dsb-bubble";
  btn.type = "button";
  btn.setAttribute("aria-label", "Chat tư vấn Daisan");
  btn.textContent = "💬";
  btn.addEventListener("click", function () {
    var open = iframe.classList.toggle("dsb-open");
    btn.textContent = open ? "✕" : "💬";
  });

  function mount() {
    document.body.appendChild(iframe);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();

import type { Env } from "./types";
import type { AlertResult } from "./alerts";

/**
 * Gửi email qua Resend (https://resend.com) — chỉ cần 1 API key, không đụng MX
 * của daisan.ai. Cấu hình:
 *   - secret RESEND_API_KEY
 *   - var EMAIL_FROM      (vd: "Daisan AI <thongbao@notify.daisan.ai>")
 *   - var ALERT_EMAIL_TO  (danh sách người nhận, cách nhau dấu phẩy)
 * Thiếu cấu hình -> emailConfigured()=false -> bỏ qua, không gửi.
 */

export function emailConfigured(env: Env): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM && env.ALERT_EMAIL_TO);
}

function recipients(env: Env): string[] {
  return (env.ALERT_EMAIL_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export async function sendEmail(env: Env, subject: string, html: string): Promise<void> {
  if (!emailConfigured(env)) throw new Error("Chưa cấu hình email (RESEND_API_KEY / EMAIL_FROM / ALERT_EMAIL_TO).");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: recipients(env), subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend lỗi ${res.status}: ${detail}`);
  }
}

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const vnd = (n: number) => Math.round(n || 0).toLocaleString("vi-VN") + " ₫";

function wrap(title: string, inner: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:680px;margin:0 auto">
    <div style="border-bottom:2px solid #4f46e5;padding-bottom:10px;margin-bottom:16px">
      <span style="font-weight:700;color:#4f46e5">✦ Trợ lý AI nội bộ — Daisan Group</span>
      <div style="font-size:12px;color:#666">${esc(title)}</div>
    </div>${inner}
    <div style="margin-top:24px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px">
      Email tự động từ Trợ lý AI nội bộ Daisan · Xem chi tiết tại troly.daisan.ai/admin</div>
  </div>`;
}

/* ----------------------------- Cảnh báo ----------------------------- */

export function alertsHaveIssues(r: AlertResult): boolean {
  return Boolean((r.receivable.count || 0) > 0 || (r.negativeStock.count || 0) > 0 || (r.unreconciled.count || 0) > 0);
}

export function alertSubject(r: AlertResult): string {
  return `🚨 Cảnh báo Daisan — Công nợ quá hạn: ${r.receivable.count ?? "?"}, Tồn kho âm: ${r.negativeStock.count ?? "?"}, Quỹ chưa ĐC: ${r.unreconciled.count ?? "?"}`;
}

export function alertHtml(r: AlertResult): string {
  const sec = (title: string, body: string) => `<h3 style="margin:18px 0 6px">${title}</h3>${body}`;
  const tbl = (head: string[], rows: string[][]) =>
    `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head
      .map((h) => `<th style="border:1px solid #ddd;padding:6px;background:#f3f4f6;text-align:left">${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${rows
      .map((r2) => `<tr>${r2.map((c) => `<td style="border:1px solid #ddd;padding:6px">${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;

  let inner = "";
  const rc = r.receivable;
  inner += sec(
    "💰 Công nợ phải thu quá hạn",
    !rc.ok
      ? `<p>⚠️ Không kiểm tra được: ${esc(rc.error || "")}</p>`
      : `<p>Số dòng quá hạn: <b style="color:${(rc.count || 0) > 0 ? "#c0392b" : "#1a9e4b"}">${rc.count || 0}</b> · Tổng: <b>${vnd(rc.total || 0)}</b></p>` +
        (rc.top && rc.top.length ? tbl(["Khách hàng", "Số tiền quá hạn"], rc.top.map((t) => [esc(t.partner), vnd(t.amount)])) : ""),
  );
  const ns = r.negativeStock;
  inner += sec(
    "📦 Tồn kho âm",
    !ns.ok
      ? `<p>⚠️ Không kiểm tra được: ${esc(ns.error || "")}</p>`
      : `<p>Số dòng tồn âm: <b style="color:${(ns.count || 0) > 0 ? "#c0392b" : "#1a9e4b"}">${ns.count || 0}</b></p>` +
        (ns.items && ns.items.length ? tbl(["Sản phẩm", "Kho", "SL"], ns.items.slice(0, 20).map((t) => [esc(t.product), esc(t.location), String(t.qty)])) : ""),
  );
  const ur = r.unreconciled;
  inner += sec(
    "🏦 Quỹ tiền / ngân hàng chưa đối chiếu",
    !ur.ok
      ? `<p>⚠️ Không kiểm tra được: ${esc(ur.error || "")}</p>`
      : `<p>Số dòng chưa đối chiếu: <b style="color:${(ur.count || 0) > 0 ? "#c0392b" : "#1a9e4b"}">${ur.count || 0}</b> · Tổng: <b>${vnd(ur.total || 0)}</b></p>`,
  );
  return wrap("Cảnh báo giám sát · " + new Date(r.generated_at).toLocaleString("vi-VN"), inner);
}

/* ----------------------------- Báo cáo ----------------------------- */

/** Markdown -> HTML tối giản (tiêu đề, đậm, gạch đầu dòng, bảng) cho email. */
export function reportHtml(title: string, md: string): string {
  const lines = esc(md).replace(/\r\n/g, "\n").split("\n");
  const inl = (s: string) => s.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  const cells = (r: string) => r.replace(/^\s*\|?/, "").replace(/\|?\s*$/, "").split("|").map((c) => c.trim());
  let html = "", i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*$/.test(l)) { i++; continue; }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { html += `<h${Math.min(h[1].length + 2, 6)}>${inl(h[2])}</h${Math.min(h[1].length + 2, 6)}>`; i++; continue; }
    if (l.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
      const head = cells(l); i += 2; let rows = "";
      while (i < lines.length && lines[i].includes("|") && !/^\s*$/.test(lines[i])) { rows += "<tr>" + cells(lines[i]).map((c) => `<td style="border:1px solid #ddd;padding:6px">${inl(c)}</td>`).join("") + "</tr>"; i++; }
      html += `<table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>${head.map((c) => `<th style="border:1px solid #ddd;padding:6px;background:#f3f4f6;text-align:left">${inl(c)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) { let it = ""; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) it += `<li>${inl(lines[i++].replace(/^\s*[-*]\s+/, ""))}</li>`; html += `<ul>${it}</ul>`; continue; }
    const buf = [l]; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*[-*]\s|\|)/.test(lines[i])) buf.push(lines[i++]);
    html += `<p>${inl(buf.join("<br>"))}</p>`;
  }
  return wrap(title, html);
}

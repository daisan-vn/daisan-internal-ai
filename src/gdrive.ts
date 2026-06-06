import type { Env } from "./types";
import { reindexAutorag } from "./rag";

/**
 * Đồng bộ Google Drive (CHỈ ĐỌC) → R2 (kho tài liệu) → AutoRAG tự index.
 *
 * Xác thực bằng Service Account (JWT RS256 -> access token, scope drive.readonly).
 * Người dùng chia sẻ thư mục Drive cho email service account (quyền Xem), rồi đặt:
 *   - secret GDRIVE_SA_JSON  = toàn bộ nội dung file khóa JSON của service account
 *   - var    GDRIVE_FOLDER_ID = ID thư mục gốc cần đồng bộ (nhiều thì cách nhau dấu phẩy)
 *
 * Mỗi file Drive được tải/explort về rồi PUT vào R2; bỏ qua nếu chưa đổi
 * (so customMetadata.driveModified với modifiedTime). KHÔNG xóa gì khỏi R2.
 * Cấu trúc thư mục con của Drive -> tiền tố (phòng ban/domain) trong R2.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";

const MAX_UPLOADS_PER_RUN = 200; // số file tải lên mỗi lần chạy (chống quá tải)
const MAX_FILES_SCAN = 1000; // số file tối đa quét metadata mỗi lần

// Google Docs/Sheets/Slides phải EXPORT (không tải trực tiếp được).
const EXPORT_MAP: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "text/markdown", ext: "md" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", ext: "csv" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", ext: "txt" },
};

// Tên thư mục con (đã bỏ dấu, viết thường) -> domain/phòng ban trong kho.
const FOLDER_DOMAIN: Record<string, string> = {
  "hop dong": "hopdong",
  "hop dong mau": "hopdong",
  sop: "sop",
  "quy trinh": "sop",
  "chinh sach": "chinhsach",
  "noi quy": "noiquy",
  "ke toan": "ketoan",
  crm: "crm",
  "mua hang": "mua",
  kho: "kho",
  odoo: "odoo",
};

export function gdriveConfigured(env: Env): boolean {
  return Boolean(env.GDRIVE_SA_JSON && env.GDRIVE_FOLDER_ID);
}

function deaccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Tên thư mục Drive -> slug domain (1 từ, không dấu). */
function domainForFolder(name: string): string {
  const norm = deaccent(name).toLowerCase().trim().replace(/\s+/g, " ");
  if (FOLDER_DOMAIN[norm]) return FOLDER_DOMAIN[norm];
  return deaccent(name).toLowerCase().replace(/[^a-z0-9]+/g, "") || "drive";
}

/** Giữ tên file dễ đọc nhưng an toàn cho key R2. */
function safeName(name: string): string {
  return name.replace(/[\\/]+/g, "_").replace(/\s+/g, "_");
}

/* ----------------------------- Xác thực Google ----------------------------- */

let cachedToken: { token: string; exp: number } | null = null;

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(s: string): string {
  return b64url(new TextEncoder().encode(s));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = JSON.parse(env.GDRIVE_SA_JSON as string) as {
    client_email: string;
    private_key: string;
  };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64urlStr(JSON.stringify(claims))}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Lấy token Google thất bại: ${data.error_description || JSON.stringify(data)}`);
  }
  cachedToken = { token: data.access_token, exp: now + 3500 };
  return data.access_token;
}

/* ------------------------------- Drive API -------------------------------- */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  prefix: string; // tiền tố R2 theo thư mục con
}

async function listFolder(
  token: string,
  folderId: string,
): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>> {
  const out: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }> = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
    const url =
      `${DRIVE_API}?q=${q}&fields=nextPageToken,files(id,name,mimeType,modifiedTime)` +
      `&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const data = (await res.json()) as {
      files?: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>;
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (data.error) throw new Error(`Drive list lỗi: ${data.error.message}`);
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

async function walk(token: string, folderId: string, prefix: string, acc: DriveFile[]): Promise<void> {
  if (acc.length >= MAX_FILES_SCAN) return;
  const items = await listFolder(token, folderId);
  for (const it of items) {
    if (it.mimeType === "application/vnd.google-apps.folder") {
      await walk(token, it.id, `${prefix}${domainForFolder(it.name)}/`, acc);
    } else {
      acc.push({ ...it, prefix });
      if (acc.length >= MAX_FILES_SCAN) return;
    }
  }
}

async function fetchContent(
  token: string,
  file: DriveFile,
): Promise<{ body: ArrayBuffer; contentType: string; key: string } | null> {
  const isGoogle = file.mimeType.startsWith("application/vnd.google-apps");
  let url: string;
  let contentType: string;
  let name = safeName(file.name);

  if (isGoogle) {
    const exp = EXPORT_MAP[file.mimeType];
    if (!exp) return null; // bỏ qua Forms/Drawings... không export được
    url = `${DRIVE_API}/${file.id}/export?mimeType=${encodeURIComponent(exp.mime)}`;
    contentType = exp.mime;
    if (!name.toLowerCase().endsWith(`.${exp.ext}`)) name = `${name}.${exp.ext}`;
  } else {
    url = `${DRIVE_API}/${file.id}?alt=media&supportsAllDrives=true`;
    contentType = file.mimeType;
  }
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Tải "${file.name}" lỗi ${res.status}`);
  return { body: await res.arrayBuffer(), contentType, key: `${file.prefix}${name}` };
}

/* ------------------------------- Đồng bộ ---------------------------------- */

export interface SyncSummary {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
  scanned: number;
  truncated: boolean;
}

export async function syncDrive(env: Env): Promise<SyncSummary> {
  const token = await getAccessToken(env);
  const roots = (env.GDRIVE_FOLDER_ID as string).split(",").map((s) => s.trim()).filter(Boolean);

  const files: DriveFile[] = [];
  for (const root of roots) await walk(token, root, "", files);

  const summary: SyncSummary = {
    added: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    scanned: files.length,
    truncated: files.length >= MAX_FILES_SCAN,
  };

  for (const file of files) {
    if (summary.added + summary.updated >= MAX_UPLOADS_PER_RUN) {
      summary.truncated = true;
      break;
    }
    try {
      const fetched = await fetchContent(token, file);
      if (!fetched) {
        summary.skipped++;
        continue;
      }
      const existing = await env.DOCS.head(fetched.key);
      if (existing?.customMetadata?.driveModified === file.modifiedTime) {
        summary.skipped++;
        continue;
      }
      await env.DOCS.put(fetched.key, fetched.body, {
        httpMetadata: { contentType: fetched.contentType },
        customMetadata: {
          source: "gdrive",
          driveId: file.id,
          driveModified: file.modifiedTime,
          driveName: file.name,
        },
      });
      if (existing) summary.updated++;
      else summary.added++;
    } catch (err) {
      summary.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return summary;
}

/* ---- Trạng thái đồng bộ lưu trong D1 (không để lẫn vào kho tài liệu) ---- */

export async function readSyncStatus(env: Env): Promise<unknown> {
  try {
    const row = await env.DB.prepare("SELECT * FROM sync_status WHERE id = 'drive'").first();
    return row ?? { state: "idle" };
  } catch {
    return { state: "idle" };
  }
}

async function writeSyncStatus(
  env: Env,
  state: string,
  fields: { summary?: SyncSummary; error?: string } = {},
): Promise<void> {
  const now = Date.now();
  try {
    await env.DB.prepare(
      `INSERT INTO sync_status (id, state, started_at, finished_at, summary, error)
       VALUES ('drive', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state=excluded.state,
         started_at=CASE WHEN excluded.state='running' THEN excluded.started_at ELSE sync_status.started_at END,
         finished_at=excluded.finished_at, summary=excluded.summary, error=excluded.error`,
    )
      .bind(
        state,
        now,
        state === "running" ? null : now,
        fields.summary ? JSON.stringify(fields.summary) : null,
        fields.error ?? null,
      )
      .run();
  } catch {
    // không chặn luồng chính
  }
}

/** Chạy đồng bộ + ghi trạng thái (gọi qua ctx.waitUntil hoặc từ cron). */
export async function runSyncWithStatus(env: Env): Promise<void> {
  await writeSyncStatus(env, "running");
  try {
    const summary = await syncDrive(env);
    // Có tài liệu mới/cập nhật -> yêu cầu AutoRAG index lại ngay (không chặn).
    if (summary.added + summary.updated > 0) await reindexAutorag(env);
    await writeSyncStatus(env, "done", { summary });
  } catch (err) {
    await writeSyncStatus(env, "error", { error: err instanceof Error ? err.message : String(err) });
  }
}

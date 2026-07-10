// Client-side Google integration for the Manifest Import module.
// Uses Google Identity Services (OAuth token flow — no backend needed) with
// read-only Gmail + Drive scopes. Requires a Google OAuth Client ID, stored in
// app_settings under "google_client_id" (admin-editable in the module).

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}
interface GoogleGis {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string;
        scope: string;
        callback: (resp: { access_token?: string; error?: string }) => void;
      }) => TokenClient;
    };
  };
}

declare global {
  interface Window { google?: GoogleGis }
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Could not load Google sign-in script"));
      document.head.appendChild(s);
    });
  }
  return gisLoading;
}

let cachedToken: { token: string; expires: number } | null = null;

/** Pop the Google consent flow (once/hour) and return an access token. */
export async function getGoogleToken(clientId: string): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.token;
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.access_token) {
          cachedToken = { token: resp.access_token, expires: Date.now() + 50 * 60_000 };
          resolve(resp.access_token);
        } else {
          reject(new Error(resp.error ?? "Google sign-in was cancelled"));
        }
      },
    });
    client.requestAccessToken();
  });
}

async function gapi<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

const MANIFEST_EXTS = /\.(csv|xlsx|xls|xlsm|pdf)$/i;

// ---- Gmail ------------------------------------------------------------------

export interface GmailAttachment {
  messageId: string;
  attachmentId: string;
  filename: string;
  subject: string;
  from: string;
  date: string;
}

interface GmailPart {
  filename?: string;
  body?: { attachmentId?: string; size?: number };
  parts?: GmailPart[];
}

/** Search Gmail for manifest attachments (by sender, text such as a load #). */
export async function gmailSearchAttachments(
  token: string,
  opts: { from?: string; query?: string; days?: number },
): Promise<GmailAttachment[]> {
  const terms = ["has:attachment"];
  if (opts.from?.trim()) terms.push(`from:${opts.from.trim()}`);
  if (opts.query?.trim()) terms.push(opts.query.trim());
  if (opts.days) terms.push(`newer_than:${opts.days}d`);
  const q = encodeURIComponent(terms.join(" "));

  const list = await gapi<{ messages?: { id: string }[] }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=25`,
  );
  const out: GmailAttachment[] = [];
  for (const m of list.messages ?? []) {
    const msg = await gapi<{
      payload?: GmailPart & { headers?: { name: string; value: string }[] };
    }>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`);
    const headers = msg.payload?.headers ?? [];
    const h = (name: string) => headers.find((x) => x.name.toLowerCase() === name)?.value ?? "";
    const walk = (part?: GmailPart) => {
      if (!part) return;
      if (part.filename && part.body?.attachmentId && MANIFEST_EXTS.test(part.filename)) {
        out.push({
          messageId: m.id,
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          subject: h("subject"),
          from: h("from"),
          date: h("date"),
        });
      }
      part.parts?.forEach(walk);
    };
    walk(msg.payload);
  }
  return out;
}

export async function gmailDownloadAttachment(
  token: string,
  messageId: string,
  attachmentId: string,
): Promise<ArrayBuffer> {
  const att = await gapi<{ data: string }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
  );
  const b64 = att.data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ---- Google Drive -------------------------------------------------------------

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  path: string;
  modifiedTime: string;
}

/** Accepts a raw folder ID or any Drive folder URL. */
export function parseDriveFolderId(input: string): string {
  const s = input.trim();
  const m = s.match(/folders\/([A-Za-z0-9_-]+)/) ?? s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? m[1] : s;
}

const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** List manifest-like files in a folder, recursing into nested folders. */
export async function driveListRecursive(
  token: string,
  folderId: string,
  nameFilter?: string,
): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  const queue: { id: string; path: string }[] = [{ id: folderId, path: "" }];
  let visited = 0;
  while (queue.length > 0 && visited < 50 && out.length < 500) {
    const { id, path } = queue.shift()!;
    visited++;
    const q = encodeURIComponent(`'${id}' in parents and trashed=false`);
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)");
    const res = await gapi<{ files?: { id: string; name: string; mimeType: string; modifiedTime: string }[] }>(
      token,
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    for (const f of res.files ?? []) {
      if (f.mimeType === FOLDER_MIME) {
        queue.push({ id: f.id, path: path ? `${path}/${f.name}` : f.name });
      } else if (f.mimeType === SHEET_MIME || MANIFEST_EXTS.test(f.name)) {
        if (nameFilter && !f.name.toLowerCase().includes(nameFilter.toLowerCase())) continue;
        out.push({ ...f, path });
      }
    }
  }
  return out;
}

/** Download a Drive file (Google Sheets export as CSV). */
export async function driveDownload(
  token: string,
  file: DriveFile,
): Promise<{ name: string; data: ArrayBuffer }> {
  const url =
    file.mimeType === SHEET_MIME
      ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text%2Fcsv`
      : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const data = await res.arrayBuffer();
  const name = file.mimeType === SHEET_MIME ? `${file.name}.csv` : file.name;
  return { name, data };
}

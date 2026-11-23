// Field inbox, browser side (docs/field-inbox.md): the field-inbox function calls, and uploads with real progress.
// Uploads go to the same Core UploadFile endpoint the SDK uses, through XMLHttpRequest so the page can show
// bytes sent. Base44 storage takes up to 100 MB per video or audio file and 40 MB per photo; a longer video is
// split into byte chunks (one storage file each) that the queue runner joins back with cat before analysing it.
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { IS_QA } from "@/lib/qa";

export const MB = 1024 * 1024;
export const LIMITS = { video: 100 * MB, audio: 100 * MB, image: 40 * MB };
export const CHUNK = 95 * MB; // under the 100 MB video limit, with room for the multipart envelope
export const MAX_PARTS = 12; // ~1.1 GB per video

export const kindOf = (file) => (String(file?.type || "").startsWith("video/") ? "video" : String(file?.type || "").startsWith("image/") ? "image" : String(file?.type || "").startsWith("audio/") ? "audio" : /\.(mov|mp4|m4v|3gp|webm)$/i.test(file?.name || "") ? "video" : /\.(jpe?g|png|heic|webp|gif)$/i.test(file?.name || "") ? "image" : "file");
export const fmtMB = (n) => `${(Number(n || 0) / MB).toFixed(n >= 10 * MB ? 0 : 1)} MB`;

// What happens to a file before upload: ok | split (video over 100 MB) | too_big | unsupported.
export function planFile(file) {
  const kind = kindOf(file);
  if (kind === "file") return { kind, action: "unsupported", note: "Only videos and photos" };
  const limit = LIMITS[kind];
  if (file.size <= limit) return { kind, action: "ok", parts: 1 };
  if (kind === "video") {
    const parts = Math.ceil(file.size / CHUNK);
    if (parts <= MAX_PARTS) return { kind, action: "split", parts, note: `${fmtMB(file.size)}: sent in ${parts} parts` };
    return { kind, action: "too_big", note: `${fmtMB(file.size)} is over ${fmtMB(CHUNK * MAX_PARTS)}. Trim it first.` };
  }
  return { kind, action: "too_big", note: `${fmtMB(file.size)} is over the ${fmtMB(limit)} photo limit` };
}

function token() {
  try { return localStorage.getItem("base44_access_token") || appParams.token || ""; } catch { return appParams.token || ""; }
}

function xhrUpload(blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", blob, name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/apps/${appParams.appId}/integration-endpoints/Core/UploadFile`);
    xhr.setRequestHeader("X-App-Id", String(appParams.appId));
    const t = token();
    if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded, e.total); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { data = null; }
      if (xhr.status >= 200 && xhr.status < 300 && data && (data.file_url || data.url)) resolve(data.file_url || data.url);
      else reject(new Error((data && (data.detail || data.message || data.error)) || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.timeout = 30 * 60 * 1000;
    xhr.send(form);
  });
}

async function uploadBlob(blob, name, onProgress) {
  if (IS_QA) { onProgress?.(blob.size, blob.size); return `https://example.test/qa/${encodeURIComponent(name)}`; }
  try {
    return await xhrUpload(blob, name, onProgress);
  } catch (e) {
    // The SDK path (no byte progress) as a fallback, e.g. if the session token is held elsewhere.
    if (/\(40[13]\)/.test(e.message)) {
      const file = blob instanceof File ? blob : new File([blob], name, { type: blob.type });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onProgress?.(blob.size, blob.size);
      return file_url;
    }
    throw e;
  }
}

// One picked file -> one media item { url, type, mime, size, name, duration, parts?, part_urls? }.
export async function uploadMedia(file, { onProgress, duration = 0 } = {}) {
  const plan = planFile(file);
  if (plan.action === "unsupported" || plan.action === "too_big") throw new Error(plan.note);
  const base = { type: plan.kind, mime: file.type || "", size: file.size, name: file.name, duration: Math.round(duration || 0) };
  if (plan.action === "ok") {
    const url = await uploadBlob(file, file.name, (sent) => onProgress?.(sent / file.size));
    return { ...base, url };
  }
  const stem = file.name.replace(/\.[^.]+$/, "") || "video";
  const ext = (file.name.match(/\.([^.]+)$/) || [, "mp4"])[1];
  const urls = [];
  for (let i = 0; i < plan.parts; i += 1) {
    const start = i * CHUNK;
    const part = file.slice(start, Math.min(file.size, start + CHUNK), file.type || "video/mp4");
    const name = `${stem}.part${String(i + 1).padStart(2, "0")}of${String(plan.parts).padStart(2, "0")}.${ext}`;
    urls.push(await uploadBlob(part, name, (sent) => onProgress?.((start + sent) / file.size)));
  }
  return { ...base, url: urls[0], parts: urls.length, part_urls: urls };
}

// Reads a picked video's length in the browser (no upload needed). 0 when the browser cannot tell.
export function readDuration(file) {
  return new Promise((resolve) => {
    if (kindOf(file) !== "video") { resolve(0); return; }
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (n) => { URL.revokeObjectURL(url); resolve(Number.isFinite(n) ? n : 0); };
    v.preload = "metadata";
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    v.src = url;
  });
}

const call = async (action, args = {}) => {
  const r = await base44.functions.invoke("field-inbox", { action, ...args });
  const data = r?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
};

export const fieldStatus = () => call("status");
export const saveNumbers = (numbers) => call("save_numbers", { numbers });
export const routeText = (text, clientId) => call("route", { text, client_id: clientId || "" });
export const submitSiteVisit = (payload) => call("site_visit", payload);

export const INTENT_LABEL = { task: "Task", idea: "Idea", note: "Note", claude_job: "Claude job", site_visit: "Site visit" };
export const STATUS_TONE = {
  new: "bg-ink/[0.07] text-ink/70", routed: "bg-green-100 text-green-800", processing: "bg-[#ff6a00]/15 text-[#c24100]",
  done: "bg-green-100 text-green-800", failed: "bg-red-100 text-red-700", ignored: "bg-ink/[0.05] text-ink/45",
};

// Share images (/share-images): copy a client logo or background photo that blocks cross-site reading (CORS)
// into Møthership's own public storage, so the browser canvas can draw it and export JPGs. Admin only.
//   { url } -> { ok, file_url }
// Only https images up to 8 MB. Reads the public file the same way any visitor's browser would; nothing on the
// client's site is changed.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif", "image/avif": "avif" };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== "admin") return Response.json({ ok: false, error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
    const b = await req.json().catch(() => ({}));
    let u: URL;
    try { u = new URL(String(b.url || "")); } catch { return Response.json({ ok: false, error: "Not a valid URL" }, { status: 400 }); }
    if (u.protocol !== "https:") return Response.json({ ok: false, error: "Only https URLs" }, { status: 400 });
    const res = await fetch(u.toString(), { headers: { "user-agent": "Mothership-ShareImages/1.0", accept: "image/*" }, redirect: "follow" });
    if (!res.ok) return Response.json({ ok: false, error: `The file returned ${res.status}` }, { status: 400 });
    const type = String(res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ext = TYPES[type];
    if (!ext) return Response.json({ ok: false, error: `Not an image (${type || "unknown type"})` }, { status: 400 });
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > 8 * 1024 * 1024) return Response.json({ ok: false, error: "Image is over 8 MB" }, { status: 400 });
    const base = (u.pathname.split("/").pop() || "logo").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "logo";
    const up: any = await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([bytes], `share-${base}.${ext}`, { type }) });
    if (!up?.file_url) return Response.json({ ok: false, error: "Upload failed" }, { status: 500 });
    return Response.json({ ok: true, file_url: up.file_url });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as any)?.message || e) }, { status: 500 });
  }
});

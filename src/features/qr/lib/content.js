// What a QR code encodes. Ported from Wørmhole's qr-content.js (link, text, email, Wi-Fi, WhatsApp)
// plus phone + SMS and Møthership's dynamic codes.
//
// Static code: the data itself is in the image. It can never be changed or tracked, and it never breaks.
// Dynamic code: the image holds a short Møthership link (REDIRECT_BASE?c=<short_code>). The `qr` backend
// function looks the code up, logs an anonymous scan and 302s to the editable destination.

// Public redirect endpoint (same host the Stärboard reviews endpoint uses). Each code stores the exact
// URL it was minted with in `encoded_url`, so changing this constant later never alters a printed code.
export const REDIRECT_BASE = "https://m-thership.base44.app/functions/qr";
export const redirectUrl = (code) => `${REDIRECT_BASE}?c=${encodeURIComponent(code)}`;

export const CONTENT_TYPES = [
  { id: "link", label: "Link" },
  { id: "text", label: "Text" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Call" },
  { id: "sms", label: "SMS" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "whatsapp", label: "WhatsApp" },
];

export function normalizeUrl(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
  return "https://" + s;
}

// Only plain web links may be QR destinations (no javascript:, data:, file:, credentials in the URL...).
export function httpUrl(u) {
  const s = normalizeUrl(u);
  if (!s || s.length > 2000) return null;
  try {
    const x = new URL(s);
    if (x.protocol !== "https:" && x.protocol !== "http:") return null;
    if (x.username || x.password || !x.hostname.includes(".")) return null;
    return x.toString();
  } catch {
    return null;
  }
}

export function buildContent(d) {
  const t = d?.content_type || "link";
  if (t === "link") return httpUrl(d.url) || "";
  if (t === "text") return d.text || "";
  if (t === "email") {
    const params = [];
    if (d.email_subject) params.push("subject=" + encodeURIComponent(d.email_subject));
    if (d.email_body) params.push("body=" + encodeURIComponent(d.email_body));
    return d.email_to ? "mailto:" + d.email_to.trim() + (params.length ? "?" + params.join("&") : "") : "";
  }
  if (t === "phone") {
    const n = String(d.phone || "").replace(/[^0-9+]/g, "");
    return n ? `tel:${n}` : "";
  }
  if (t === "sms") {
    const n = String(d.phone || "").replace(/[^0-9+]/g, "");
    return n ? `SMSTO:${n}:${d.sms_body || ""}` : "";
  }
  if (t === "wifi") {
    if (!d.wifi_ssid) return "";
    const esc = (s) => String(s || "").replace(/([\\;,:"])/g, "\\$1");
    const enc = d.wifi_encryption || "WPA";
    return `WIFI:T:${enc};S:${esc(d.wifi_ssid)};${enc === "nopass" ? "" : `P:${esc(d.wifi_password)};`}${d.wifi_hidden ? "H:true;" : ""};`;
  }
  if (t === "whatsapp") {
    const n = String(d.whatsapp_number || "").replace(/[^0-9]/g, "");
    return n ? `https://wa.me/${n}${d.whatsapp_message ? "?text=" + encodeURIComponent(d.whatsapp_message) : ""}` : "";
  }
  return "";
}

export const isDynamic = (d) => d?.mode === "dynamic";
export const PENDING_CODE = "pending";

// The exact string drawn into the image.
export function encodedValue(d) {
  if (isDynamic(d)) return d.encoded_url || (d.short_code ? redirectUrl(d.short_code) : redirectUrl(PENDING_CODE));
  return buildContent(d);
}

export function previewText(d) {
  if (isDynamic(d)) return d.destination || "";
  const t = d?.content_type || "link";
  if (t === "link") return d.url || "";
  if (t === "text") return String(d.text || "").slice(0, 60);
  if (t === "email") return d.email_to || "";
  if (t === "phone" || t === "sms") return d.phone || "";
  if (t === "wifi") return d.wifi_ssid || "Wi-Fi network";
  if (t === "whatsapp") return d.whatsapp_number || "";
  return "";
}

// What a phone does after scanning, in plain words (for the scan test panel).
export function scanOutcome(d) {
  if (isDynamic(d)) return d.destination ? `Opens ${d.destination} (via your trackable Interstellar link)` : "Opens your destination link";
  const t = d?.content_type || "link";
  if (t === "link") return `Opens ${d.url || "your link"}`;
  if (t === "text") return "Shows your text";
  if (t === "email") return `Starts an email to ${d.email_to || "you"}`;
  if (t === "phone") return `Calls ${d.phone || "your number"}`;
  if (t === "sms") return `Starts a text to ${d.phone || "your number"}`;
  if (t === "wifi") return `Joins the "${d.wifi_ssid || ""}" Wi-Fi network`;
  if (t === "whatsapp") return "Opens a WhatsApp chat";
  return "";
}

export const fileSlug = (s) => String(s || "qr-code").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "qr-code";

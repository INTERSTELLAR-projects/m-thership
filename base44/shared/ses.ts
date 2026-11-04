// Amazon SES v2 SendEmail over plain fetch with AWS Signature Version 4 (no AWS SDK in Deno).
// Secrets: AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, AWS_SES_REGION (e.g. us-west-2). Values are only ever
// used to sign requests: never returned, logged or stored.
// Endpoint: POST https://email.<region>.amazonaws.com/v2/email/outbound-emails  (service name "ses").

import { getSecret } from "./portalClient.ts";

const enc = new TextEncoder();
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer)).map((x) => x.toString(16).padStart(2, "0")).join("");
async function sha256(s: string) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(s))); }
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}

export async function signingKey(secret: string, date: string, region: string, service: string) {
  const kDate = await hmac(enc.encode(`AWS4${secret}`), date);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  return await hmac(kService, "aws4_request");
}

export type SesConfig = { accessKeyId: string; secretAccessKey: string; region: string };

export function sesConfig(): SesConfig | null {
  const accessKeyId = getSecret("AWS_SES_ACCESS_KEY_ID");
  const secretAccessKey = getSecret("AWS_SES_SECRET_ACCESS_KEY");
  const region = getSecret("AWS_SES_REGION");
  if (!accessKeyId || !secretAccessKey || !/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) return null;
  return { accessKeyId, secretAccessKey, region };
}

// Signs and sends one SES v2 request. `now` is injectable for tests.
export async function signedRequest(cfg: SesConfig, method: string, path: string, payload: string, now = new Date()) {
  const host = `email.${cfg.region}.amazonaws.com`;
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = await sha256(payload);
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const canonical = [method, path, "", `content-type:application/json\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, signedHeaders, payloadHash].join("\n");
  const scope = `${date}/${cfg.region}/ses/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n");
  const sig = hex(await hmac(await signingKey(cfg.secretAccessKey, date, cfg.region, "ses"), toSign));
  return {
    url: `https://${host}${path}`,
    headers: {
      "content-type": "application/json",
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
    },
  };
}

export class SesError extends Error {
  status: number; code: string; retryable: boolean;
  constructor(status: number, code: string, message: string) {
    super(message); this.status = status; this.code = code;
    this.retryable = status === 429 || status >= 500 || /Throttl|TooManyRequests|LimitExceeded/i.test(code);
  }
}

// RFC 2047 for non-ASCII display names ("GravïtyCare" etc).
const encodeName = (name: string) => {
  const n = String(name || "").replace(/["\r\n]/g, "").trim();
  if (!n) return "";
  return /^[\x20-\x7e]*$/.test(n) ? `"${n}"` : `=?UTF-8?B?${btoa(String.fromCharCode(...enc.encode(n)))}?=`;
};

export async function sesSendEmail(cfg: SesConfig, m: {
  from: string; fromName?: string; to: string; replyTo?: string; subject: string; html: string; text?: string;
  unsubscribeUrl?: string; tags?: Record<string, string>; configurationSet?: string;
}) {
  const headers: { Name: string; Value: string }[] = [];
  if (m.unsubscribeUrl) {
    headers.push({ Name: "List-Unsubscribe", Value: `<${m.unsubscribeUrl}>` });
    headers.push({ Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" });
  }
  const payload: Record<string, unknown> = {
    FromEmailAddress: m.fromName ? `${encodeName(m.fromName)} <${m.from}>` : m.from,
    Destination: { ToAddresses: [m.to] },
    Content: {
      Simple: {
        Subject: { Data: m.subject, Charset: "UTF-8" },
        Body: { Html: { Data: m.html, Charset: "UTF-8" }, ...(m.text ? { Text: { Data: m.text, Charset: "UTF-8" } } : {}) },
        ...(headers.length ? { Headers: headers } : {}),
      },
    },
    EmailTags: Object.entries(m.tags || {}).filter(([, v]) => v).map(([Name, Value]) => ({ Name, Value: String(Value).replace(/[^A-Za-z0-9_\-.@]/g, "_").slice(0, 256) })),
  };
  if (m.replyTo) payload.ReplyToAddresses = [m.replyTo];
  if (m.configurationSet) payload.ConfigurationSetName = m.configurationSet;
  const body = JSON.stringify(payload);
  const { url, headers: h } = await signedRequest(cfg, "POST", "/v2/email/outbound-emails", body);
  const res = await fetch(url, { method: "POST", headers: h, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(res.headers.get("x-amzn-errortype") || data?.__type || data?.code || `HTTP${res.status}`).split(":")[0];
    throw new SesError(res.status, code, String(data?.message || data?.Message || code).slice(0, 300));
  }
  return { messageId: String(data?.MessageId || "") };
}

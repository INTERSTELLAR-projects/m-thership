// Signed one-click unsubscribe tokens for Email Studio mass / subscriber sends.
// token = base64url(email) + "." + base64url(HMAC-SHA256(key, "email-unsub:v1:" + email)) (first 24 bytes).
// The key is EMAIL_UNSUB_SECRET when set, else a purpose-bound key derived from MFA_ENCRYPTION_KEY, so a token
// cannot be forged or reused for anything else. Nothing secret is ever put in the link besides the signature.

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function hmac(keyBytes: Uint8Array, msg: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

async function unsubKey() {
  const own = Deno.env.get("EMAIL_UNSUB_SECRET");
  if (own) return enc.encode(own);
  const base = Deno.env.get("MFA_ENCRYPTION_KEY");
  if (!base) throw new Error("No signing secret configured for unsubscribe links");
  return await hmac(enc.encode(base), "derive:email-unsubscribe:v1");
}

export const normEmail = (e: unknown) => String(e || "").trim().toLowerCase();

export async function unsubToken(email: string) {
  const e = normEmail(email);
  const sig = (await hmac(await unsubKey(), `email-unsub:v1:${e}`)).slice(0, 24);
  return `${b64url(enc.encode(e))}.${b64url(sig)}`;
}

// Returns the email the token was issued for, or null when it is malformed or the signature does not match.
export async function verifyUnsubToken(token: string): Promise<string | null> {
  try {
    const [p, s] = String(token || "").split(".");
    if (!p || !s || p.length > 400) return null;
    const email = new TextDecoder().decode(fromB64url(p));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
    const expected = (await hmac(await unsubKey(), `email-unsub:v1:${email}`)).slice(0, 24);
    const given = fromB64url(s);
    if (given.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < given.length; i++) diff |= given[i] ^ expected[i];
    return diff === 0 ? email : null;
  } catch {
    return null;
  }
}

export async function unsubscribeUrl(baseUrl: string, email: string) {
  return `${String(baseUrl || "https://interstellar-mothership.com").replace(/\/+$/, "")}/functions/email-unsubscribe?t=${encodeURIComponent(await unsubToken(email))}`;
}

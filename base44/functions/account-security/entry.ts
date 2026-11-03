import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import {
  json, isConfigured, securityRow, isEnabled, isLocked, sessionVerified, markSessionVerified, clearSessions,
  recordFailure, clearFailures, encryptBytes, decryptBytes, base32, verifyTotp, newRecoveryCodes, hashRecovery,
  keyedHash, sixDigits, safeEqual, maskEmail, EMAIL_TTL_MS, bearerOf,
} from "../../shared/twoFactor.ts";
import { SENDER_NAME, REG, LINK_RESET_CSS, mailLink } from "../../shared/onboardingEmail.ts";

// Account > Security for portal logins (see base44/shared/twoFactor.ts for the security model).
//   status                      -> what is on, whether this session has passed, recovery codes left
//   verify {method, code}       -> pass the second step for this session (totp | email | recovery)
//   send_email_code {purpose}   -> email a 6-digit code (purpose: verify | enable)
//   totp_begin / totp_confirm   -> set up an authenticator app
//   email_confirm {code}        -> turn on email codes
//   disable {method, code}      -> turn a method off (needs a passed session AND a fresh code)
//   recovery_regenerate         -> new recovery codes (needs a passed session)
//   admin_list / admin_reset    -> admins: who has 2-step on; turn it off for a locked-out client
// Secrets and code hashes never leave this function; the authenticator secret is returned once, at setup only.

const ISSUER = "Interstellar Møthership";
const SEND_GAP_MS = 45 * 1000;
const SENDS_PER_HOUR = 5;
const PENDING_TTL_MS = 15 * 60 * 1000;

function codeEmail(code: string, purpose: string) {
  const F = "font-family:Helvetica,Arial,sans-serif;";
  const what = purpose === "enable" ? "turn on email codes for your portal" : "finish signing in to your portal";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Interstellar sign-in code</title><style>${LINK_RESET_CSS}</style></head>
<body id="body" style="margin:0;padding:0;background:#ebe8e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ebe8e4"><tr><td align="center" style="padding:24px 10px 40px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:560px;">
<tr><td height="6" bgcolor="#ff3c00" style="height:6px;line-height:6px;font-size:0;background-image:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00);">&nbsp;</td></tr>
<tr><td bgcolor="#0f0f0f" style="background-color:#0f0f0f;padding:30px 36px 34px;${F}">
<div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#ffffff;">INTERSTELLAR${REG}</div>
<div style="padding-top:26px;font-size:13px;font-weight:700;letter-spacing:1.5px;color:#9a9893;text-transform:uppercase;"><span style="color:#ff3c00;">+</span>&nbsp; Two-step verification</div>
<div style="padding-top:12px;font-size:34px;line-height:38px;font-weight:700;letter-spacing:-1px;color:#ffffff;">Your code <span style="color:#ff3c00;">/${code}</span></div>
<div style="padding-top:16px;font-size:15px;line-height:23px;color:#d6d4cf;">Enter it to ${what}. It works once and expires in 10 minutes.</div>
<div style="padding-top:16px;font-size:13px;line-height:20px;color:#9a9893;">Didn't try to sign in? Someone may have your password. Change it, and email ${mailLink("justin@interstellar-strategies.com", "#ff6a00")}.</div>
</td></tr>
<tr><td height="6" bgcolor="#ffaa00" style="height:6px;line-height:6px;font-size:0;background-image:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);">&nbsp;</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: `${code} is your Interstellar sign-in code`, html };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return json({ error: "Not signed in" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");
    const db = base44.asServiceRole.entities;

    // ---- Admin tools ----
    if (action === "admin_list" || action === "admin_reset") {
      if (user.role !== "admin") return json({ error: "Admins only" }, 403);
      if (action === "admin_list") {
        const rows = (await db.AccountSecurity.list("-updated_date", 500).catch(() => [])) || [];
        return json({
          configured: isConfigured(),
          logins: rows.filter(isEnabled).map((r: any) => ({ email: r.email, totp: r.totp_enabled === true, email_code: r.email_enabled === true, recovery_left: (r.recovery_hashes || []).length, enabled_at: r.enabled_at, last_verified_at: r.last_verified_at, locked: isLocked(r) })),
        });
      }
      const email = String(body?.email || "").trim().toLowerCase();
      if (!email) return json({ error: "Email is required" }, 400);
      const rows = ((await db.AccountSecurity.filter({ email }, "-created_date", 10).catch(() => [])) || []) as any[];
      if (!rows.length) return json({ error: "That login doesn't have 2-step verification on." }, 404);
      for (const r of rows) {
        await clearSessions(db, r.user_id);
        await db.AccountSecurity.update(r.id, { totp_enabled: false, totp_secret_enc: null, totp_pending_enc: null, email_enabled: false, email_code_hash: null, recovery_hashes: [], failed_attempts: 0, locked_until: null, reset_by: user.email, reset_at: new Date().toISOString() });
      }
      return json({ ok: true, email });
    }

    if (user.role === "admin") {
      return json({ error: "Admin sign-in is protected by your Google account's 2-Step Verification. App-level 2-step verification is for client portal logins.", code: "admin_not_supported" }, 400);
    }
    if (!isConfigured()) return json({ error: "2-step verification isn't available yet.", code: "not_configured" }, 503);

    let s: any = await securityRow(db, user);
    const ensureRow = async () => {
      if (!s) s = await db.AccountSecurity.create({ user_id: String(user.id), email: String(user.email || "").toLowerCase(), totp_enabled: false, email_enabled: false, recovery_hashes: [], failed_attempts: 0 });
      return s;
    };
    const enabled = isEnabled(s);
    const verified = enabled ? await sessionVerified(db, user, req) : false;
    // Changing settings on a protected login needs a session that already passed the second step.
    const mayChange = !enabled || verified;

    const status = () => ({
      configured: true,
      enabled,
      totp: s?.totp_enabled === true,
      email_code: s?.email_enabled === true,
      verified,
      recovery_left: (s?.recovery_hashes || []).length,
      locked_until: isLocked(s) ? s.locked_until : null,
      email_hint: maskEmail(user.email),
      enabled_at: s?.enabled_at || null,
    });

    const issueRecovery = async () => {
      const codes = newRecoveryCodes();
      const hashes = await Promise.all(codes.map(hashRecovery));
      return { codes, hashes };
    };

    if (action === "status") return json(status());

    // Turning anything on binds this session; without a session credential on the request that binding can't
    // happen, and the login would lock itself out. Refuse up front.
    if (["totp_begin", "totp_confirm", "email_confirm"].includes(action) || (action === "send_email_code" && body?.purpose === "enable")) {
      if (!bearerOf(req)) return json({ error: "This browser session can't turn on 2-step verification. Sign out, sign in again and retry." }, 400);
    }

    if (action === "send_email_code") {
      const purpose = body?.purpose === "enable" ? "enable" : "verify";
      if (purpose === "verify" && !(s?.email_enabled === true)) return json({ error: "Email codes aren't turned on for this login." }, 400);
      if (purpose === "enable" && !mayChange) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      if (purpose === "enable" && s?.email_enabled === true) return json({ error: "Email codes are already on." }, 400);
      await ensureRow();
      if (isLocked(s)) return json({ error: "Too many tries. Wait a few minutes and try again.", locked_until: s.locked_until }, 429);
      const recent = ((s.email_sends || []) as string[]).filter((t) => Date.now() - Date.parse(t) < 60 * 60 * 1000);
      const last = recent.length ? Math.max(...recent.map((t) => Date.parse(t))) : 0;
      if (Date.now() - last < SEND_GAP_MS) return json({ error: "A code was just sent. Wait a moment before asking for another." }, 429);
      if (recent.length >= SENDS_PER_HOUR) return json({ error: "Too many codes sent this hour. Try again later or use a recovery code." }, 429);
      const code = sixDigits();
      await db.AccountSecurity.update(s.id, {
        email_code_hash: await keyedHash(code, `email|${user.id}|${purpose}`),
        email_code_purpose: purpose,
        email_code_expires: new Date(Date.now() + EMAIL_TTL_MS).toISOString(),
        email_sends: [...recent, new Date().toISOString()],
      });
      const { subject, html } = codeEmail(code, purpose);
      await base44.asServiceRole.integrations.Core.SendEmail({ to: String(user.email), subject, body: html, from_name: SENDER_NAME });
      return json({ ok: true, sent_to: maskEmail(user.email) });
    }

    const checkEmailCode = async (code: string, purpose: string) => {
      if (!s?.email_code_hash || s.email_code_purpose !== purpose || !s.email_code_expires || Date.parse(s.email_code_expires) < Date.now()) return false;
      const c = String(code || "").replace(/\s+/g, "");
      if (!/^\d{6}$/.test(c)) return false;
      return safeEqual(await keyedHash(c, `email|${user.id}|${purpose}`), String(s.email_code_hash));
    };

    if (action === "verify") {
      if (!enabled) return json({ ok: true, verified: true, not_required: true });
      if (isLocked(s)) return json({ error: "Too many tries. Wait a few minutes and try again.", locked_until: s.locked_until }, 429);
      const method = String(body?.method || "");
      const code = String(body?.code || "");
      let ok = false;
      const patch: Record<string, unknown> = {};
      if (method === "totp" && s.totp_enabled) {
        const step = await verifyTotp(await decryptBytes(s.totp_secret_enc), code, Number(s.totp_last_step) || -1);
        if (step !== null) { ok = true; patch.totp_last_step = step; }
      } else if (method === "email" && s.email_enabled) {
        if (await checkEmailCode(code, "verify")) { ok = true; patch.email_code_hash = null; patch.email_code_expires = null; }
      } else if (method === "recovery") {
        const h = await hashRecovery(code);
        const list = (s.recovery_hashes || []) as string[];
        const idx = list.findIndex((x) => safeEqual(x, h));
        if (idx >= 0) { ok = true; patch.recovery_hashes = list.filter((_, i) => i !== idx); }
      } else {
        return json({ error: "That method isn't on for this login." }, 400);
      }
      if (!ok) {
        const locked = await recordFailure(db, s);
        return json({ error: locked ? "Too many tries. Wait 15 minutes and try again." : "That code didn't work. Check it and try again.", locked_until: locked }, locked ? 429 : 400);
      }
      await clearFailures(db, s, patch);
      const bound = await markSessionVerified(db, user, req, method);
      if (!bound) return json({ error: "Your session couldn't be confirmed. Sign out and sign in again." }, 400);
      return json({ ok: true, verified: true, recovery_left: method === "recovery" ? (patch.recovery_hashes as string[]).length : (s.recovery_hashes || []).length });
    }

    if (action === "totp_begin") {
      if (!mayChange) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      if (s?.totp_enabled) return json({ error: "An authenticator app is already set up. Turn it off first to set up a new one." }, 400);
      await ensureRow();
      const secret = crypto.getRandomValues(new Uint8Array(20));
      await db.AccountSecurity.update(s.id, { totp_pending_enc: await encryptBytes(secret), totp_pending_at: new Date().toISOString() });
      const b32 = base32(secret);
      const label = encodeURIComponent(`${ISSUER}:${String(user.email)}`);
      return json({ secret: b32, otpauth_uri: `otpauth://totp/${label}?secret=${b32}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30` });
    }

    if (action === "totp_confirm") {
      if (!mayChange) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      if (!s?.totp_pending_enc || !s.totp_pending_at || Date.now() - Date.parse(s.totp_pending_at) > PENDING_TTL_MS) return json({ error: "Setup timed out. Start again." }, 400);
      if (isLocked(s)) return json({ error: "Too many tries. Wait a few minutes and try again.", locked_until: s.locked_until }, 429);
      const step = await verifyTotp(await decryptBytes(s.totp_pending_enc), String(body?.code || ""));
      if (step === null) {
        const locked = await recordFailure(db, s);
        return json({ error: locked ? "Too many tries. Wait 15 minutes and try again." : "That code didn't match. Check the time on your phone and try the newest code.", locked_until: locked }, locked ? 429 : 400);
      }
      const first = !isEnabled(s);
      const rec = (s.recovery_hashes || []).length ? null : await issueRecovery();
      await clearFailures(db, s, {
        totp_enabled: true, totp_secret_enc: s.totp_pending_enc, totp_pending_enc: null, totp_pending_at: null, totp_last_step: step,
        ...(rec ? { recovery_hashes: rec.hashes } : {}), ...(first ? { enabled_at: new Date().toISOString() } : {}),
      });
      await markSessionVerified(db, user, req, "setup");
      return json({ ok: true, recovery_codes: rec ? rec.codes : null });
    }

    if (action === "email_confirm") {
      if (!mayChange) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      if (!s) return json({ error: "Send a code first." }, 400);
      if (isLocked(s)) return json({ error: "Too many tries. Wait a few minutes and try again.", locked_until: s.locked_until }, 429);
      if (!(await checkEmailCode(String(body?.code || ""), "enable"))) {
        const locked = await recordFailure(db, s);
        return json({ error: locked ? "Too many tries. Wait 15 minutes and try again." : "That code didn't work. Check it, or send a new one.", locked_until: locked }, locked ? 429 : 400);
      }
      const first = !isEnabled(s);
      const rec = (s.recovery_hashes || []).length ? null : await issueRecovery();
      await clearFailures(db, s, {
        email_enabled: true, email_code_hash: null, email_code_expires: null,
        ...(rec ? { recovery_hashes: rec.hashes } : {}), ...(first ? { enabled_at: new Date().toISOString() } : {}),
      });
      await markSessionVerified(db, user, req, "setup");
      return json({ ok: true, recovery_codes: rec ? rec.codes : null });
    }

    if (action === "disable") {
      if (!enabled) return json({ error: "2-step verification is already off." }, 400);
      if (!verified) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      if (isLocked(s)) return json({ error: "Too many tries. Wait a few minutes and try again.", locked_until: s.locked_until }, 429);
      const method = String(body?.method || "");
      const code = String(body?.code || "");
      let ok = false;
      const patch: Record<string, unknown> = {};
      if (method === "totp" && s.totp_enabled) {
        const step = await verifyTotp(await decryptBytes(s.totp_secret_enc), code, Number(s.totp_last_step) || -1);
        if (step !== null) { ok = true; Object.assign(patch, { totp_enabled: false, totp_secret_enc: null, totp_last_step: null }); }
      } else if (method === "email" && s.email_enabled) {
        // Turning email codes off is confirmed with a code sent for "verify".
        if (await checkEmailCode(code, "verify")) { ok = true; Object.assign(patch, { email_enabled: false, email_code_hash: null, email_code_expires: null }); }
      } else {
        return json({ error: "That method isn't on." }, 400);
      }
      if (!ok) {
        const locked = await recordFailure(db, s);
        return json({ error: locked ? "Too many tries. Wait 15 minutes and try again." : "That code didn't work.", locked_until: locked }, locked ? 429 : 400);
      }
      const stillOn = (method === "totp" ? s.email_enabled : s.totp_enabled) === true;
      if (!stillOn) Object.assign(patch, { recovery_hashes: [], enabled_at: null });
      await clearFailures(db, s, patch);
      if (!stillOn) await clearSessions(db, user.id);
      return json({ ok: true, enabled: stillOn });
    }

    if (action === "recovery_regenerate") {
      if (!enabled) return json({ error: "Turn on 2-step verification first." }, 400);
      if (!verified) return json({ error: "Finish signing in first.", code: "2fa_required" }, 428);
      const rec = await issueRecovery();
      await db.AccountSecurity.update(s.id, { recovery_hashes: rec.hashes });
      return json({ ok: true, recovery_codes: rec.codes });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (_e) {
    return json({ error: "Security service error. Try again." }, 500);
  }
});

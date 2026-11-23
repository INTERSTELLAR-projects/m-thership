// Portal terms gate (docs/portal-terms.md): hash check, gate decision, acceptance validation, append-only rules.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  normalizeBody, sha256Hex, hashMatches, hasAccepted, previousAccepted, gateDecision, acceptanceErrors, clientIp,
  buildAcceptance, planPublish, clientTermsStatus, REQUIRED_CHECKS,
} from "../../base44/shared/terms.js";
import { DRAFT_V1 } from "../../base44/shared/termsDraftV1.js";

const ROOT = join(__dirname, "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "");

const BODY = "# Terms\r\n\r\nSection one.   \r\nSection two.\r\n\r\n";
const ACTIVE = { id: "tv1", version: "2026-11-23", title: "Interstellar Terms of Service", body_markdown: BODY };
const user = { email: "Owner@Client.test", full_name: "Owner Person", role: "user" };
const client = { id: "c1", business: "Client Co" };
const ticks = Object.fromEntries(REQUIRED_CHECKS.map((c) => [c.key, true]));

describe("hash check", () => {
  it("hashes the normalized body (line endings and trailing spaces do not change it)", async () => {
    const h = await sha256Hex(BODY);
    expect(h).toBe(createHash("sha256").update("# Terms\n\nSection one.\nSection two.").digest("hex"));
    expect(await sha256Hex("# Terms\n\nSection one.\nSection two.\n")).toBe(h);
    expect(normalizeBody("  a \r\nb\t\r\n")).toBe("a\nb");
  });
  it("any change to the words changes the fingerprint, and hashMatches catches an edited body", async () => {
    const h = await sha256Hex(BODY);
    expect(await sha256Hex(BODY.replace("one", "1"))).not.toBe(h);
    expect(await hashMatches({ ...ACTIVE, sha256: h })).toBe(true);
    expect(await hashMatches({ ...ACTIVE, sha256: h.toUpperCase() })).toBe(true);
    expect(await hashMatches({ ...ACTIVE, body_markdown: BODY + "edited after publishing", sha256: h })).toBe(false);
    expect(await hashMatches({ ...ACTIVE, sha256: "" })).toBe(false);
    expect(await hashMatches(null)).toBe(false);
  });
});

describe("gate decision", () => {
  const active = { ...ACTIVE, sha256: "abc" };
  const acc = (o = {}) => ({ client_id: "c1", user_email: "owner@client.test", version: "2026-11-23", terms_sha256: "abc", accepted_at: "2026-11-23T10:00:00Z", ...o });
  it("blocks a client login that has not accepted the active version", () => {
    expect(gateDecision({ user, client, active, acceptances: [] })).toEqual({ required: true, reason: "never_signed" });
  });
  it("opens once this login accepted this exact version (email case-insensitive)", () => {
    expect(gateDecision({ user, client, active, acceptances: [acc()] }).required).toBe(false);
  });
  it("re-prompts on a new version or a changed text, and knows the previous version", () => {
    expect(gateDecision({ user, client, active: { ...active, version: "2027-01-01" }, acceptances: [acc()] })).toEqual({ required: true, reason: "new_version" });
    expect(gateDecision({ user, client, active: { ...active, sha256: "def" }, acceptances: [acc()] }).required).toBe(true);
    expect(previousAccepted([acc(), acc({ version: "2026-01-01", accepted_at: "2026-01-01" })], { clientId: "c1", email: user.email, version: "2027-01-01" }).version).toBe("2026-11-23");
  });
  it("is per login and per client: another login or another client does not count", () => {
    expect(gateDecision({ user, client, active, acceptances: [acc({ user_email: "staff@client.test" })] }).required).toBe(true);
    expect(gateDecision({ user, client, active, acceptances: [acc({ client_id: "c2" })] }).required).toBe(true);
    expect(hasAccepted([acc()], { clientId: "c1", email: "OWNER@client.test", version: "2026-11-23", sha256: "ABC" })).toBe(true);
  });
  it("never gates admins, lead-tier logins, or anyone when no version is active", () => {
    expect(gateDecision({ user: { ...user, role: "admin" }, client, active, acceptances: [] }).required).toBe(false);
    expect(gateDecision({ user, client: { ...client, portal_tier: "lead" }, active, acceptances: [] }).required).toBe(false);
    expect(gateDecision({ user, client, active: null, acceptances: [] }).required).toBe(false);
  });
});

describe("acceptance validation (server side)", () => {
  const active = { ...ACTIVE, sha256: "abc" };
  const ok = { active, sentVersionId: "tv1", sentSha: "abc", checks: ticks, signature: "Owner Q. Person", scrolledToEnd: true };
  it("accepts a complete submission", () => { expect(acceptanceErrors(ok)).toEqual([]); });
  it("refuses a stale version or text the person did not see", () => {
    expect(acceptanceErrors({ ...ok, sentVersionId: "old" })[0]).toMatch(/changed/);
    expect(acceptanceErrors({ ...ok, sentSha: "zzz" })[0]).toMatch(/not the current version/);
    expect(acceptanceErrors({ ...ok, active: null })[0]).toMatch(/no active version/);
  });
  it("needs both ticks, a real typed name and scrolling to the end", () => {
    expect(acceptanceErrors({ ...ok, checks: { agree_tos: true } }).join(" ")).toMatch(/cancellation/);
    expect(acceptanceErrors({ ...ok, checks: { agree_tos: "true", agree_cancellation: true } }).length).toBe(1); // must be boolean true
    expect(acceptanceErrors({ ...ok, signature: "  " })).toContain("Type your full legal name to sign.");
    expect(acceptanceErrors({ ...ok, signature: "123" })).toContain("Type your full legal name to sign.");
    expect(acceptanceErrors({ ...ok, scrolledToEnd: false })).toContain("Scroll to the end of the terms first.");
  });
  it("stamps server values and never trusts browser time or IP", () => {
    const rec = buildAcceptance({ client, user, active, signature: "  Owner   Person ", checks: ticks, scrolledToEnd: true, ip: "203.0.113.9", userAgent: "UA", acceptedAt: "2026-11-23T20:00:00.000Z" });
    expect(rec).toMatchObject({ client_id: "c1", client_name: "Client Co", user_email: "owner@client.test", typed_signature: "Owner Person", version: "2026-11-23", terms_sha256: "abc", accepted_at: "2026-11-23T20:00:00.000Z", ip: "203.0.113.9", scrolled_to_end: true });
    expect(rec.checkbox_confirmations.every((c) => c.checked && c.label)).toBe(true);
    expect(Object.keys(rec)).not.toContain("id");
  });
  it("reads the client IP from the first X-Forwarded-For hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" }))).toBe("198.51.100.7");
    expect(clientIp({ "cf-connecting-ip": "198.51.100.8" })).toBe("198.51.100.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("publishing and status", () => {
  const vs = [{ id: "a", version: "2026-01-01", status: "active" }, { id: "r", version: "2025-01-01", status: "retired" }, { id: "d", version: "2026-11-23", status: "draft" }];
  it("activates the draft and retires the current active version (one active at a time)", () => {
    expect(planPublish(vs, "d")).toEqual({ activate: "d", retire: ["a"] });
  });
  it("refuses non-drafts, unknown ids and duplicate version labels", () => {
    expect(planPublish(vs, "a").error).toBeTruthy();
    expect(planPublish(vs, "nope").error).toBeTruthy();
    expect(planPublish([...vs, { id: "d2", version: "2026-01-01", status: "draft" }], "d2").error).toMatch(/already exists/);
  });
  it("client chip: signed / needs the new version / not signed", () => {
    const active = { version: "v2", sha256: "x" };
    expect(clientTermsStatus([{ client_id: "c1", version: "v2", terms_sha256: "x", accepted_at: "2" }], { clientId: "c1", active }).label).toBe("Signed vv2");
    expect(clientTermsStatus([{ client_id: "c1", version: "v1", terms_sha256: "y", accepted_at: "1" }], { clientId: "c1", active }).state).toBe("signed_old");
    expect(clientTermsStatus([], { clientId: "c1", active })).toMatchObject({ state: "not_signed", label: "Not signed" });
  });
});

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (["node_modules", "dist", ".git"].includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(jsx?|tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

describe("append-only rules", () => {
  it("TermsAcceptance: only the service role may create; nobody else may update or delete", () => {
    const rls = JSON.parse(strip(read("base44/entities/TermsAcceptance.jsonc"))).rls;
    for (const op of ["create", "update", "delete"]) expect(rls[op], op).toEqual({ user_condition: { role: "__service_only__" } });
    expect(JSON.stringify(rls.read)).toContain("{{user.email}}");
  });
  it("no code anywhere updates or deletes a TermsAcceptance", () => {
    const files = [...walk(join(ROOT, "base44")), ...walk(join(ROOT, "src"))];
    const hits = files.filter((p) => /TermsAcceptance\s*\.\s*(update|delete|bulkUpdate|deleteMany)\s*\(/.test(readFileSync(p, "utf8")));
    expect(hits).toEqual([]);
  });
  it("TermsVersion: admins write, signed-in users read only active or retired text", () => {
    const rls = JSON.parse(strip(read("base44/entities/TermsVersion.jsonc"))).rls;
    expect(rls.create).toEqual({ user_condition: { role: "admin" } });
    expect(JSON.stringify(rls.read)).toContain("retired");
    expect(JSON.stringify(rls.read)).not.toContain("draft");
  });
});

describe("copies stay in sync and the draft holds only Justin's numbers", () => {
  it("src/lib/terms.js is identical to base44/shared/terms.js", () => {
    expect(read("src/lib/terms.js").split("\n").slice(2).join("\n")).toBe(read("base44/shared/terms.js"));
  });
  it("the QA draft copy is identical to the shared draft", () => {
    expect(read("src/features/terms/draftV1.js").split("\n").slice(1).join("\n")).toBe(read("base44/shared/termsDraftV1.js"));
  });
  it("draft v1: 30 days' notice, the $750 migration fee, Oregon, E-SIGN/UETA, and no other dollar amounts", () => {
    const all = `${DRAFT_V1.body_markdown}\n${DRAFT_V1.summary_points.join("\n")}`;
    expect(all).toMatch(/30 days' written notice/);
    expect(all).toMatch(/\$750/);
    expect(all).toMatch(/State of Oregon/);
    expect(all).toMatch(/E-SIGN/);
    expect(all).toMatch(/Uniform Electronic Transactions Act/);
    expect([...all.matchAll(/\$\s?\d[\d,]*/g)].map((m) => m[0]).every((m) => m === "$750")).toBe(true);
  });
});

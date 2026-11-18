// Client Email Studio pure logic (base44/shared/emailCore.ts, clientEmail.ts).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as core from "../../base44/shared/emailCore.ts";
import { renderClientEmail, themeFrom, contrast, readable, onColor, normalizeClientBlocks } from "../../base44/shared/clientEmail.ts";

const KEY = new TextEncoder().encode("unit-test-key-not-a-secret");

describe("signed tokens", () => {
  it("round-trips and rejects tampering", async () => {
    const t = await core.signToken(KEY, "t", core.trackPayload({ src: "c", id: "camp123", rid: "contact9", link: 2 }));
    expect(core.parseTrackPayload(await core.verifyToken(KEY, "t", t))).toEqual({ src: "c", id: "camp123", step: "", rid: "contact9", link: 2 });
    const [p, s] = t.split(".");
    const forged = `${core.b64url(new TextEncoder().encode("c|camp123||contact9|5"))}.${s}`;
    expect(await core.verifyToken(KEY, "t", forged)).toBeNull();
    expect(await core.verifyToken(KEY, "other", t)).toBeNull();
    expect(p.length).toBeGreaterThan(5);
  });
  it("tracking tokens carry no email address", async () => {
    const rid = await core.ridFor(KEY, "", "Jane@Example.com");
    expect(rid).toMatch(/^h[0-9a-f]{20}$/);
    const t = await core.signToken(KEY, "t", core.trackPayload({ src: "c", id: "x1", rid }));
    expect(atob(t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))).not.toContain("@");
    expect(await core.ridFor(KEY, "abc123", "x@y.com")).toBe("abc123");
  });
});

describe("tracking injection", () => {
  const html = `<a href="https://a.com/x?y=1&amp;z=2">A</a><a href="mailto:x@y.com">M</a><a href="{{unsubscribe_url}}">U</a><a href="https://b.com">B</a><a href="https://a.com/x?y=1&amp;z=2">A2</a></body>`;
  it("extracts unique trackable links only", () => {
    expect(core.extractLinks(html)).toEqual(["https://a.com/x?y=1&z=2", "https://b.com"]);
  });
  it("rewrites links and adds the pixel", () => {
    const links = core.extractLinks(html);
    const out = core.addPixel(core.rewriteLinks(html, links, (i) => `T${i}`), "PX");
    expect(out.match(/href="T0"/g).length).toBe(2);
    expect(out).toContain('href="T1"');
    expect(out).toContain('href="mailto:x@y.com"');
    expect(out).toContain('href="{{unsubscribe_url}}"');
    expect(out).toMatch(/<img src="PX"[^>]*><\/body>/);
  });
});

describe("personalize", () => {
  it("fills tags, escapes values, falls back", () => {
    expect(core.personalize("Hi {{first_name}} {{ last_name }}", { first_name: "<b>Al</b>" }, true)).toBe("Hi &lt;b&gt;Al&lt;/b&gt; ");
    expect(core.personalize("Hi {{first_name}}", {}, false)).toBe("Hi there");
    expect(core.personalize('<a href="{{unsubscribe_url}}">', { unsubscribe_url: "https://x/?a=1&b=2" }, true)).toBe('<a href="https://x/?a=1&b=2">');
  });
});

describe("time zones", () => {
  it("converts wall-clock time to UTC across DST", () => {
    expect(core.zonedToUtc("2026-11-20T09:00", "America/New_York").toISOString()).toBe("2026-11-20T14:00:00.000Z");
    expect(core.zonedToUtc("2026-07-20T09:00", "America/Los_Angeles").toISOString()).toBe("2026-07-20T16:00:00.000Z");
    expect(core.zonedToUtc("2026-11-20T09:00", "Asia/Tokyo").toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(core.zonedToUtc("nope", "UTC")).toBeNull();
    expect(core.validTz("Mars/Base")).toBe(false);
  });
});

describe("segments", () => {
  const now = Date.parse("2026-11-17T12:00:00Z");
  const c = { email: "a@b.com", tags: ["vip", "hoa"], list_ids: ["L1"], city: "Molalla", state: "OR", zip: "97038", created_at: "2026-11-10T00:00:00Z", last_opened_at: "2026-11-01T00:00:00Z", fields: { plan: "Gold" } };
  it("evaluates each rule type", () => {
    expect(core.matchesRule(c, { field: "tag", op: "has", value: "VIP" }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "tag", op: "not_has", value: "vip" }, now)).toBe(false);
    expect(core.matchesRule(c, { field: "list", op: "in", value: "L1" }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "city", op: "is", value: "molalla" }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "zip", op: "starts_with", value: "970" }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "created", op: "within_days", value: 30 }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "last_opened", op: "within_days", value: 7 }, now)).toBe(false);
    expect(core.matchesRule(c, { field: "last_opened", op: "not_within_days", value: 7 }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "last_clicked", op: "not_within_days", value: 90 }, now)).toBe(true);
    expect(core.matchesRule(c, { field: "field", key: "plan", op: "is", value: "gold" }, now)).toBe(true);
  });
  it("all / any", () => {
    const rules = [{ field: "tag", op: "has", value: "vip" }, { field: "state", op: "is", value: "WA" }];
    expect(core.matchSegment(c, { match: "all", rules }, now)).toBe(false);
    expect(core.matchSegment(c, { match: "any", rules }, now)).toBe(true);
  });
});

describe("import rows", () => {
  it("maps columns, normalizes dates and tags, rejects bad email", () => {
    const head = ["Email Address", "First Name", "Last", "Tags", "ZIP", "Birthday", "Plan"];
    const map = core.guessMapping(head);
    expect(map).toMatchObject({ email: 0, first_name: 1, last_name: 2, tags: 3, zip: 4, birthday: 5 });
    const row = core.rowToContact([" Sam@Example.COM ", "Sam", "Lee", "VIP; Spring Clean", "97038", "4/9", "Gold"], map, { plan: 6 });
    expect(row).toMatchObject({ email: "sam@example.com", first_name: "Sam", name: "Sam Lee", tags: ["vip", "spring-clean"], birthday: "04-09", fields: { plan: "Gold" } });
    expect(core.rowToContact(["not-an-email"], map).error).toBe("invalid_email");
  });
});

describe("webhook signature", () => {
  it("accepts a fresh valid signature and rejects the rest", async () => {
    const body = JSON.stringify({ event: "job.completed", email: "a@example.com" });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await core.hookSignature("k3y", ts, body);
    expect(await core.verifyHookSignature("k3y", ts, body, sig)).toEqual({ ok: true });
    expect((await core.verifyHookSignature("k3y", ts, body + " ", sig)).reason).toBe("bad_signature");
    expect((await core.verifyHookSignature("k3y", String(Number(ts) - 900), body, sig)).reason).toBe("stale_timestamp");
    expect((await core.verifyHookSignature("", ts, body, sig)).reason).toBe("key_not_configured");
    expect(core.triggerSecretName("Summit Roofing Co.")).toBe("EMAIL_TRIGGER_KEY_SUMMIT_ROOFING_CO");
  });
});

describe("client email renderer", () => {
  it("is byte-identical in src and base44/shared", () => {
    expect(readFileSync("src/features/email-studio/clientEmail.js", "utf8")).toBe(readFileSync("base44/shared/clientEmail.ts", "utf8"));
  });
  it("renders brand, CAN-SPAM footer and safe text", () => {
    const th = themeFrom({ business: "Oak & Ember", kit: { palette: [{ hex: "#FFD400", role: "primary" }] }, address: "1 Main St, Molalla, OR 97038" });
    const html = renderClientEmail({ subject: "Hi", blocks: [{ type: "text", text: "Hi {{first_name}}, <script>x</script> **bold** [site](https://oak.example)" }, { type: "button", label: "Book", url: "https://oak.example/book" }] }, th);
    expect(html).toContain("{{unsubscribe_url}}");
    expect(html).toContain("1 Main St, Molalla, OR 97038");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('color:#111111;text-decoration:none'); // dark text on a yellow button
    expect(contrast(readable("#FFD400"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(onColor("#0B0B0C")).toBe("#ffffff");
    expect(normalizeClientBlocks([{ type: "evil" }, { type: "button", url: "javascript:alert(1)", label: "x" }])[0].url).toBe("");
  });
});

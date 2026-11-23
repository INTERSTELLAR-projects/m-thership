// Field inbox (docs/field-inbox.md): signature check, sender allowlist, dedupe, routing rules, client match,
// and a simulated WhatsApp webhook POST signed with a test-only secret (no real WhatsApp, no network).
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifySignature, safeEqual, hmacHex, parseAllowed, isAllowedSender, extractMessages, dedupeMessages, ruleIntent,
  routeDecision, matchClient, titleFrom, confirmationText, siteVisitBrief, fieldJobBrief, WEBHOOK_URL, maskNumber,
} from "../../base44/shared/fieldInbox.js";

const TEST_SECRET = "test-only-app-secret-not-real"; // test fixture only; never a real Meta secret
const sign = (body, secret = TEST_SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const waBody = (messages, { phoneId = "PHONE_ID_TEST", contacts = [] } = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { display_phone_number: "15550001111", phone_number_id: phoneId }, contacts, messages } }] }],
});

const CLIENTS = [
  { id: "ps", business: "Palm Shore Hardscapes & Design", contact: "Miguel Santos", domain: "palmshorehardscapes.com" },
  { id: "rb", business: "Royalz Barbers", contact: "Jen Montiel", domain: "royalzbarbers.com" },
  { id: "bb", business: "Bobablastic", domain: "bobablastic.com" },
  { id: "cg", business: "Chasing Gains Coaching", bundle: "Chase package" },
];

describe("signature (X-Hub-Signature-256)", () => {
  it("accepts the HMAC of the raw body with the app secret", async () => {
    const body = JSON.stringify(waBody([]));
    expect(await verifySignature(body, sign(body), TEST_SECRET)).toBe(true);
    expect(await hmacHex(TEST_SECRET, body)).toBe(sign(body).slice(7));
  });
  it("rejects a missing header, a missing secret, a wrong secret, a changed body and a bad format", async () => {
    const body = JSON.stringify(waBody([]));
    expect(await verifySignature(body, "", TEST_SECRET)).toBe(false);
    expect(await verifySignature(body, null, TEST_SECRET)).toBe(false);
    expect(await verifySignature(body, sign(body), "")).toBe(false);
    expect(await verifySignature(body, sign(body, "other-secret"), TEST_SECRET)).toBe(false);
    expect(await verifySignature(body + " ", sign(body), TEST_SECRET)).toBe(false);
    expect(await verifySignature(body, sign(body).slice(7), TEST_SECRET)).toBe(false); // no sha256= prefix
    expect(await verifySignature(body, "sha1=" + sign(body).slice(7), TEST_SECRET)).toBe(false);
  });
  it("accepts an upper-case hex digest (case-insensitive) and compares in constant time", async () => {
    const body = "{}";
    expect(await verifySignature(body, sign(body).toUpperCase().replace("SHA256=", "sha256="), TEST_SECRET)).toBe(true);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("sender allowlist", () => {
  it("parses numbers from the secret and from settings, adding the US country code", () => {
    expect(parseAllowed("+1 (503) 555-0100, 15035550101", ["5035550102"])).toEqual(["15035550100", "15035550101", "15035550102"]);
    expect(parseAllowed("")).toEqual([]);
    expect(parseAllowed("12")).toEqual([]); // too short to be a phone number
  });
  it("lets only Justin's numbers through", () => {
    const allowed = parseAllowed("15035550100");
    expect(isAllowedSender("15035550100", allowed)).toBe(true);
    expect(isAllowedSender("+1 503 555 0100", allowed)).toBe(true);
    expect(isAllowedSender("15035550199", allowed)).toBe(false);
    expect(isAllowedSender("", allowed)).toBe(false);
    expect(isAllowedSender("15035550100", [])).toBe(false);
  });
  it("masks numbers for display", () => {
    expect(maskNumber("15035550100")).toBe("+•••••••0100");
  });
});

describe("payload extraction and dedupe", () => {
  it("flattens text, voice notes, video with caption and images; skips status callbacks", () => {
    const body = waBody([
      { from: "15035550100", id: "wamid.A", timestamp: "1", type: "text", text: { body: "task: call Miguel" } },
      { from: "15035550100", id: "wamid.B", timestamp: "2", type: "audio", audio: { id: "MEDIA_B", mime_type: "audio/ogg; codecs=opus", voice: true } },
      { from: "15035550100", id: "wamid.C", timestamp: "3", type: "video", video: { id: "MEDIA_C", mime_type: "video/mp4", caption: "Fix their website" } },
      { from: "15035550100", id: "wamid.D", timestamp: "4", type: "image", image: { id: "MEDIA_D", mime_type: "image/jpeg" } },
    ], { contacts: [{ wa_id: "15035550100", profile: { name: "Justin" } }] });
    body.entry[0].changes.push({ field: "messages", value: { statuses: [{ id: "wamid.X", status: "delivered" }] } });
    const msgs = extractMessages(body);
    expect(msgs.map((m) => m.id)).toEqual(["wamid.A", "wamid.B", "wamid.C", "wamid.D"]);
    expect(msgs[0]).toMatchObject({ type: "text", text: "task: call Miguel", media: null, contact_name: "Justin", phone_number_id: "PHONE_ID_TEST" });
    expect(msgs[1].media).toMatchObject({ id: "MEDIA_B", kind: "audio", voice: true });
    expect(msgs[2]).toMatchObject({ text: "Fix their website", media: { id: "MEDIA_C", kind: "video" } });
    expect(msgs[3].text).toBe("");
  });
  it("drops messages already stored and repeats inside one body", () => {
    const msgs = [{ id: "a" }, { id: "b" }, { id: "a" }, { id: "" }, { id: "c" }];
    expect(dedupeMessages(msgs, ["b"]).map((m) => m.id)).toEqual(["a", "c"]);
    expect(dedupeMessages(msgs, []).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("routing rules", () => {
  it("task: and 'add a task' -> task", () => {
    expect(ruleIntent("task: call Miguel about the patio")).toMatchObject({ intent: "task" });
    expect(ruleIntent("Todo - renew the domain")).toMatchObject({ intent: "task" });
    expect(ruleIntent("add a task to follow up with Jen")).toMatchObject({ intent: "task" });
    expect(ruleIntent("Add this as a task: build the Royalz page")).toMatchObject({ intent: "task" }); // explicit wins over 'build'
  });
  it("idea: -> idea, note: -> note", () => {
    expect(ruleIntent("idea: punch cards in every Command System")).toMatchObject({ intent: "idea" });
    expect(ruleIntent("I have an idea for a boba loyalty app")).toMatchObject({ intent: "idea" });
    expect(ruleIntent("note: Royalz closes early on Sundays")).toMatchObject({ intent: "note" });
    expect(ruleIntent("Note for Palm Shore: Miguel wants travertine")).toMatchObject({ intent: "note" });
  });
  it("work verbs -> claude_job", () => {
    for (const t of ["Build a pricing page for Bobablastic", "fix the hours on Royalz", "redo the hero", "make a flyer", "research competitors in Bluffton", "write the welcome email"]) {
      expect(ruleIntent(t), t).toMatchObject({ intent: "claude_job", rule: "work_verb" });
    }
    expect(ruleIntent("rebuilding trust with the client")).toBe(null); // whole words only
  });
  it("video with a prompt -> site_visit; ambiguous text -> no rule", () => {
    expect(ruleIntent("map how they take orders", { hasVideo: true })).toMatchObject({ intent: "site_visit", rule: "video_with_prompt" });
    expect(ruleIntent("", { hasVideo: true })).toMatchObject({ intent: "site_visit", rule: "video_no_prompt" });
    expect(ruleIntent("Miguel liked the pavers")).toBe(null);
  });
  it("decides: rules beat the LLM, a confident LLM fills the gap, everything else is a Task in Inbox", () => {
    expect(routeDecision({ text: "task: call Miguel", clientId: "ps" })).toMatchObject({ intent: "task", status: "next", client_id: "ps" });
    expect(routeDecision({ text: "task: call the bank" })).toMatchObject({ intent: "task", status: "inbox" });
    expect(routeDecision({ text: "idea: x", llm: { intent: "claude_job", confidence: 0.99 } })).toMatchObject({ intent: "idea", rule: "idea_prefix" });
    expect(routeDecision({ text: "Miguel liked the pavers", llm: { intent: "note", confidence: 0.82, client_id: "ps" } })).toMatchObject({ intent: "note", rule: "llm", client_id: "ps" });
    expect(routeDecision({ text: "hmm", llm: { intent: "idea", confidence: 0.3 } })).toMatchObject({ intent: "task", status: "inbox", rule: "ambiguous" });
    expect(routeDecision({ text: "hmm", llm: { intent: "unclear", confidence: 0.9 } })).toMatchObject({ intent: "task", status: "inbox", rule: "ambiguous" });
    expect(routeDecision({ text: "something", llm: null })).toMatchObject({ intent: "task", status: "inbox", rule: "ambiguous" });
    expect(routeDecision({ text: "", hasVideo: true })).toMatchObject({ intent: "task", status: "inbox", rule: "video_no_prompt" });
    expect(routeDecision({ text: "fix their site", hasVideo: true })).toMatchObject({ intent: "site_visit" });
  });
  it("matches clients by name, short form, domain, owner and bundle; ties do not match", () => {
    expect(matchClient("task: call about the Palm Shore patio", CLIENTS)?.id).toBe("ps");
    expect(matchClient("note for royalz barbers: new chair", CLIENTS)?.id).toBe("rb");
    expect(matchClient("fix the menu on bobablastic.com", CLIENTS)?.id).toBe("bb");
    expect(matchClient("Jen Montiel wants Sunday hours", CLIENTS)?.id).toBe("rb");
    expect(matchClient("bill the Chase package", CLIENTS)?.id).toBe("cg");
    expect(matchClient("buy groceries", CLIENTS)).toBe(null);
    expect(matchClient("royal blue paint", CLIENTS)).toBe(null);
    expect(matchClient("Acme and Acme", [{ id: "1", business: "Acme" }, { id: "2", business: "Acme" }])).toBe(null);
  });
  it("titles and confirmations", () => {
    expect(titleFrom("task: Call Miguel about the patio quote. He is free after 3.")).toBe("Call Miguel about the patio quote.");
    expect(confirmationText({ intent: "task", title: "Call Miguel", clientName: "Palm Shore", status: "next" })).toBe("Saved as a task for Palm Shore: Call Miguel");
    expect(confirmationText({ intent: "task", title: "Call the bank", status: "inbox" })).toBe("Saved to your task inbox: Call the bank");
    expect(confirmationText({ intent: "claude_job", title: "Royalz Barbers: fix the hours" })).toBe("Queued for Claude: Royalz Barbers: fix the hours");
    expect(confirmationText({ intent: "idea", title: "Punch cards" })).toBe("Saved to the Idea Vault: Punch cards");
    expect(confirmationText({ intent: "note", clientName: "Royalz Barbers" })).toBe("Noted for Royalz Barbers.");
    expect(confirmationText({ pendingTranscript: true })).toMatch(/transcribe/);
  });
});

describe("site_visit brief", () => {
  it("is a complete brief: media, prompt, business, outputs, steps and the no-publish rule", () => {
    const b = siteVisitBrief({
      fieldId: "F1", lead: { name: "Seaside Tile", website: "https://seasidetile.test", city: "Bluffton" }, prompt: "fix their website and build it",
      media: [{ type: "video", url: "https://media.test/a.mp4", size: 5 * 1048576, duration: 42, name: "IMG_1.MOV" }, { type: "video", url: "https://media.test/p1.mp4", part_urls: ["https://media.test/p1.mp4", "https://media.test/p2.mp4"], name: "big.mov" }],
      outputs: { website: true, operations: true, content: false },
    });
    for (const s of ["Site visit: Seaside Tile", "https://media.test/a.mp4", "part 01: https://media.test/p1.mp4", "part 02: https://media.test/p2.mp4", "fix their website and build it", "Bluffton", "FieldInbox id: F1", "Website improvements", "Operations / Command System plan", "ffmpeg", "faster-whisper", "lead_build", "BuildChecklistTemplate", "ClientFile", "Analysis and drafts only", "Real facts only", "nobody at the business is contacted"]) {
      expect(b, s).toContain(s);
    }
    expect(b).not.toContain("- Content clips\n");
  });
  it("marks a [TEST] job and tells the runner not to create leads for it", () => {
    const b = siteVisitBrief({ client: { id: "c1", business: "Summit" }, media: [], isTest: true });
    expect(b).toMatch(/^# \[TEST\] Site visit: Summit/);
    expect(b).toContain("do not create a CRMClient");
  });
  it("field job brief carries the text and the voice-note path", () => {
    expect(fieldJobBrief({ text: "write the welcome email for Royalz" })).toContain("write the welcome email for Royalz");
    expect(fieldJobBrief({ pendingTranscript: true, media: [{ type: "audio", url: "https://media.test/v.ogg" }] })).toContain("faster-whisper");
  });
});

// Simulated webhook: the same checks whatsapp-inbound runs, in order, against a POST we sign ourselves.
async function simulateWebhook({ raw, header, secret = TEST_SECRET, allowed = ["15035550100"], stored = [], phoneId = "PHONE_ID_TEST" }) {
  if (!secret) return { status: 503 };
  if (!(await verifySignature(raw, header, secret))) return { status: 401 };
  const msgs = extractMessages(JSON.parse(raw)).filter((m) => !m.phone_number_id || m.phone_number_id === phoneId);
  const mine = msgs.filter((m) => isAllowedSender(m.from, allowed));
  const fresh = dedupeMessages(mine, stored);
  return { status: 200, routed: fresh.map((m) => ({ id: m.id, ...routeDecision({ text: m.text, hasVideo: m.media?.kind === "video", clientId: matchClient(m.text, CLIENTS)?.id || "" }) })) };
}

describe("simulated webhook POST (test secret only)", () => {
  const body = JSON.stringify(waBody([
    { from: "15035550100", id: "wamid.1", type: "text", text: { body: "task: send Palm Shore the travertine quote" } },
    { from: "19995550000", id: "wamid.2", type: "text", text: { body: "task: I am a stranger" } },
    { from: "15035550100", id: "wamid.3", type: "video", video: { id: "M3", mime_type: "video/mp4", caption: "Royalz Barbers: map how they book and fix the site" } },
    { from: "15035550100", id: "wamid.4", type: "text", text: { body: "write a GBP-free promo plan for Bobablastic" } },
  ]));

  it("routes Justin's messages, ignores strangers, and returns 401/503 on bad signature or missing secret", async () => {
    const ok = await simulateWebhook({ raw: body, header: sign(body) });
    expect(ok.status).toBe(200);
    expect(ok.routed).toEqual([
      expect.objectContaining({ id: "wamid.1", intent: "task", status: "next", client_id: "ps" }),
      expect.objectContaining({ id: "wamid.3", intent: "site_visit", client_id: "rb" }),
      expect.objectContaining({ id: "wamid.4", intent: "claude_job", client_id: "bb" }),
    ]);
    expect((await simulateWebhook({ raw: body, header: "" })).status).toBe(401);
    expect((await simulateWebhook({ raw: body, header: sign(body, "wrong") })).status).toBe(401);
    expect((await simulateWebhook({ raw: body, header: sign(body), secret: "" })).status).toBe(503);
  });
  it("a retried delivery creates nothing new (dedupe on message id)", async () => {
    const again = await simulateWebhook({ raw: body, header: sign(body), stored: ["wamid.1", "wamid.3", "wamid.4"] });
    expect(again.routed).toEqual([]);
  });
  it("ignores messages addressed to another phone number id", async () => {
    const other = JSON.stringify(waBody([{ from: "15035550100", id: "wamid.9", type: "text", text: { body: "task: x" } }], { phoneId: "SOMEONE_ELSE" }));
    expect((await simulateWebhook({ raw: other, header: sign(other) })).routed).toEqual([]);
  });
  it("points Meta at this app's function URL", () => {
    expect(WEBHOOK_URL).toBe("https://base44.app/api/apps/69d80bb06c5ad07a795df54e/functions/whatsapp-inbound");
  });
});

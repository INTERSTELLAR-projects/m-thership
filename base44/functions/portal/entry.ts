import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Client portal API. Every table is admin-only, so portal users never touch entities directly:
// this function finds the client their login belongs to and returns only that client's
// portal-visible records. Admins can pass client_id to preview any client's portal.

const SAFE_CLIENT = ["id", "business", "contact", "domain", "websites", "plan", "services_managed", "industry", "location", "logoUrl", "logo_url", "started_on"];
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const visible = (r: Record<string, unknown>) => r.portal_visible !== false;
const REQ_KINDS = ["site_edit", "project_submission", "job", "new_page", "question", "app_edit", "other"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { action = "home", client_id: asClient, ...args } = body || {};
    const db = base44.asServiceRole.entities;

    // Resolve the client this user may see.
    let client: Record<string, unknown> | null = null;
    if (user.role === "admin" && asClient) {
      client = await db.CRMClient.get(asClient).catch(() => null);
    } else {
      const email = String(user.email || "").toLowerCase();
      const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
      client = (all || []).find((c: Record<string, unknown>) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email)) || null;
    }
    if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });
    const cid = client.id as string;
    const by = (entity: string, sort = "-created_date", limit = 500) => db[entity].filter({ client_id: cid }, sort, limit).then((r: unknown[]) => r || []);

    // Chat helpers. Group membership lives on ChatThread.client_ids and is only ever checked here.
    const myGroups = async () => ((await db.ChatThread.filter({ kind: "group" }, "-last_message_at", 300).catch(() => [])) || [])
      .filter((g: Record<string, unknown>) => !g.archived && ((g.client_ids as string[]) || []).includes(cid)) as Record<string, unknown>[];
    const groupFor = async (id: string) => {
      const g = await db.ChatThread.get(id).catch(() => null);
      return g && g.kind === "group" && !g.archived && ((g.client_ids as string[]) || []).includes(cid) ? g as Record<string, unknown> : null;
    };
    const groupMsgs = async (gid: string) => ((await db.ConversationMessage.filter({ thread_id: gid }, "created_date", 500).catch(() => [])) || []) as Record<string, unknown>[];
    const groupUnreadCount = (ms: Record<string, unknown>[]) => ms.filter((m) => m.sender_client_id !== cid && !((m.read_by_client_ids as string[]) || []).includes(cid)).length;
    const senderOf = (c: Record<string, unknown>) => ({ id: c.id, name: c.business, logo_url: c.logo_url || "", martian_color: c.martian_color || "", accent: c.accent || "" });
    const chatOut = (m: Record<string, unknown>, sender: unknown) => ({
      id: m.id, content: m.content, sender_role: m.sender_role, at: m.created_date || m.timestamp,
      mine: m.sender_role === "client" ? (m.sender_client_id ? m.sender_client_id === cid : !m.thread_id) : user.role === "admin",
      sender,
    });

    if (action === "home") {
      const [work, autos, reqs, goals, gaps, snaps, tasks, files] = await Promise.all([
        by("WorkLog", "-date", 400), by("Automation"), by("ClientRequest"), by("ClientGoal", "sort"), by("ClientGap"),
        by("PerformanceSnapshot", "-period_end", 60), by("Task", "due_date", 200), by("ClientFile", "-delivered_on", 200),
      ]);
      const msgs = await by("ConversationMessage", "-created_date", 200);
      const groupUnread = await myGroups().then((gs) => Promise.all(gs.map(async (g) => groupUnreadCount(await groupMsgs(g.id as string))))).then((n) => n.reduce((a, b) => a + b, 0)).catch(() => 0);
      return Response.json({
        client: pick(client, SAFE_CLIENT),
        user: { email: user.email, name: user.full_name, is_admin_preview: user.role === "admin" },
        work: work.filter(visible).filter((w: Record<string, unknown>) => w.status !== "failed").map((w: Record<string, unknown>) => pick(w, ["id", "kind", "title", "url", "date", "description", "status", "verified_live"])),
        automations: autos.filter(visible).filter((a: Record<string, unknown>) => a.status === "active").map((a: Record<string, unknown>) => pick(a, ["id", "name", "kind", "schedule", "last_run_at", "runs_count"])),
        requests: reqs.map((r: Record<string, unknown>) => pick(r, ["id", "kind", "title", "details", "status", "client_note", "page_status", "page_url", "created_date", "completed_at", "attachments"])),
        goals: goals.map((g: Record<string, unknown>) => pick(g, ["id", "year", "title", "metric", "baseline_value", "target_value", "current_value", "unit", "status", "plan_steps"])),
        gaps: gaps.filter(visible).map((g: Record<string, unknown>) => pick(g, ["id", "title", "area", "severity", "status", "recommendation", "impact"])),
        snapshots: snaps.map((s: Record<string, unknown>) => pick(s, ["id", "source", "period_start", "period_end", "metrics"])),
        upcoming: tasks.filter((t: Record<string, unknown>) => t.portal_visible === true && t.status !== "done").map((t: Record<string, unknown>) => pick(t, ["id", "title", "due_date", "status"])),
        files: files.filter(visible).map((f: Record<string, unknown>) => pick(f, ["id", "title", "category", "file_url", "link_url", "description", "delivered_on"])),
        future: (await by("Project")).filter((p: Record<string, unknown>) => p.portal_visible !== false && ["proposed", "backlog", "planning", "in_progress", "review"].includes(String(p.status))).map((p: Record<string, unknown>) => pick(p, ["id", "title", "type", "status", "description", "progress", "due_date"])),
        unread: msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).length + groupUnread,
      });
    }

    // ---- Chats: the client's 1:1 with Interstellar + group chats they belong to ----
    // Never returns member lists or member counts. Membership is checked on every call.
    if (action === "chats") {
      const [direct, groups] = await Promise.all([by("ConversationMessage", "-created_date", 200), myGroups()]);
      const dLast = direct[0] as Record<string, unknown> | undefined;
      const threads: Record<string, unknown>[] = [{
        id: "direct", kind: "direct", title: "Interstellar Strategies",
        last_preview: dLast ? String(dLast.content || "").slice(0, 140) : "", last_at: dLast ? (dLast.created_date || dLast.timestamp) : null,
        unread: direct.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).length,
      }];
      for (const g of groups) {
        const ms = await groupMsgs(g.id as string);
        const last = ms[ms.length - 1] as Record<string, unknown> | undefined;
        threads.push({
          id: g.id, kind: "group", title: g.title, description: g.description || "",
          last_preview: last ? String(last.content || "").slice(0, 140) : "", last_at: last ? (last.created_date || last.timestamp) : (g.created_date || null),
          unread: groupUnreadCount(ms),
        });
      }
      return Response.json({ me: senderOf(client), threads });
    }

    if (action === "chat_messages") {
      const thread = String(args.thread || "direct");
      if (thread === "direct") {
        const msgs = await by("ConversationMessage", "created_date", 500);
        if (user.role !== "admin") {
          await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_at: new Date().toISOString() })));
        }
        return Response.json({ messages: msgs.map((m: Record<string, unknown>) => chatOut(m, m.sender_role === "client" ? senderOf(client) : null)) });
      }
      const g = await groupFor(thread);
      if (!g) return Response.json({ error: "Chat not found" }, { status: 404 });
      const msgs = await groupMsgs(g.id as string);
      if (user.role !== "admin") {
        await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_client_id !== cid && !((m.read_by_client_ids as string[]) || []).includes(cid))
          .map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_by_client_ids: [...((m.read_by_client_ids as string[]) || []), cid] })));
      }
      const ids = [...new Set(msgs.map((m: Record<string, unknown>) => m.sender_client_id).filter(Boolean) as string[])];
      const senders: Record<string, unknown> = {};
      await Promise.all(ids.map(async (id) => { const c = id === cid ? client : await db.CRMClient.get(id).catch(() => null); if (c) senders[id] = senderOf(c as Record<string, unknown>); }));
      return Response.json({
        thread: { id: g.id, kind: "group", title: g.title, description: g.description || "" },
        messages: msgs.map((m: Record<string, unknown>) => chatOut(m, m.sender_role === "client" ? (senders[m.sender_client_id as string] || { name: String(m.sender_name || "Member") }) : null)),
      });
    }

    if (action === "chat_send") {
      const thread = String(args.thread || "direct");
      const content = String(args.content || "").trim().slice(0, 5000);
      if (!content) return Response.json({ error: "Empty message" }, { status: 400 });
      const role = user.role === "admin" ? "admin" : "client";
      const now = new Date().toISOString();
      const base = { content, sender_role: role, senderEmail: user.email, messageType: "text", timestamp: now, sender_name: role === "admin" ? "Interstellar Strategies" : client.business };
      if (thread === "direct") {
        const m = await db.ConversationMessage.create({ ...base, client_id: cid, recipientEmail: role === "admin" ? (((client.emails as string[]) || [])[0] || "") : "interstellar", ...(role === "client" ? { sender_client_id: cid } : {}) });
        return Response.json({ message: chatOut(m, role === "client" ? senderOf(client) : null) });
      }
      const g = await groupFor(thread);
      if (!g) return Response.json({ error: "Chat not found" }, { status: 404 });
      const m = await db.ConversationMessage.create({ ...base, thread_id: g.id, recipientEmail: `group:${g.id}`, ...(role === "client" ? { sender_client_id: cid, read_by_client_ids: [cid] } : { read_at: now }) });
      await db.ChatThread.update(g.id as string, { last_message_at: now, last_message_preview: content.slice(0, 140) }).catch(() => null);
      return Response.json({ message: chatOut(m, role === "client" ? senderOf(client) : null) });
    }

    if (action === "messages") {
      const msgs = await by("ConversationMessage", "created_date", 500);
      if (user.role !== "admin") {
        await Promise.all(msgs.filter((m: Record<string, unknown>) => m.sender_role === "admin" && !m.read_at).map((m: Record<string, unknown>) => db.ConversationMessage.update(m.id as string, { read_at: new Date().toISOString() })));
      }
      return Response.json({ messages: msgs.map((m: Record<string, unknown>) => pick(m, ["id", "content", "sender_role", "timestamp", "created_date", "attachments"])) });
    }

    if (action === "send_message") {
      const content = String(args.content || "").trim().slice(0, 5000);
      if (!content) return Response.json({ error: "Empty message" }, { status: 400 });
      const m = await db.ConversationMessage.create({ client_id: cid, content, sender_role: user.role === "admin" ? "admin" : "client", senderEmail: user.email, messageType: "text", timestamp: new Date().toISOString() });
      return Response.json({ message: pick(m, ["id", "content", "sender_role", "timestamp", "created_date"]) });
    }

    if (action === "forms") {
      const forms = await db.RequestForm.filter({ client_id: cid, active: true });
      return Response.json({ forms: forms.map((f: Record<string, unknown>) => pick(f, ["id", "kind", "title", "intro", "fields"])) });
    }

    if (action === "create_request") {
      const kind = REQ_KINDS.includes(String(args.kind)) ? String(args.kind) : "other";
      const title = String(args.title || "").trim().slice(0, 200);
      if (!title) return Response.json({ error: "Add a title" }, { status: 400 });
      const r = await db.ClientRequest.create({
        client_id: cid, client_name: client.business, kind, title,
        details: String(args.details || "").slice(0, 8000),
        attachments: Array.isArray(args.attachments) ? args.attachments.slice(0, 20).map(String) : [],
        fields: typeof args.fields === "object" && args.fields ? args.fields : {},
        answers: Array.isArray(args.answers) ? args.answers.slice(0, 60) : [],
        form_id: args.form_id ? String(args.form_id) : null, form_title: args.form_title ? String(args.form_title).slice(0, 120) : null,
        source: "portal", contact_email: user.email,
        status: "received", priority: args.priority === "urgent" ? "urgent" : "normal",
        submitted_by: user.email, page_status: ["project_submission", "job"].includes(kind) ? "queued" : "none",
      });
      return Response.json({ request: pick(r, ["id", "kind", "title", "status", "created_date"]) });
    }

    if (action === "intake") {
      const list = await by("IntakeAudit", "-created_date", 5);
      const a = list[0];
      return Response.json({ intake: a ? pick(a, ["id", "status", "answers", "submitted_at"]) : null });
    }

    if (action === "save_intake") {
      const list = await by("IntakeAudit", "-created_date", 5);
      let a = list[0];
      const answers = typeof args.answers === "object" && args.answers ? args.answers : {};
      const submit = !!args.submit;
      if (!a) a = await db.IntakeAudit.create({ client_id: cid, business_name: client.business, contact_email: user.email, status: "in_progress", answers: {} });
      if (a.status === "reviewed" && user.role !== "admin") return Response.json({ error: "This audit was already reviewed." }, { status: 409 });
      const upd = await db.IntakeAudit.update(a.id, { answers, status: submit ? "submitted" : "in_progress", ...(submit ? { submitted_at: new Date().toISOString() } : {}) });
      return Response.json({ intake: pick(upd, ["id", "status", "answers", "submitted_at"]) });
    }

    // ---- Prestige referral program: the client's own referrer record, read-only (plus join + "seen") ----
    if (action === "prestige" || action === "prestige_seen" || action === "prestige_join") {
      const DEF = {
        referral_base_url: "https://interstellar-strategies.com/contact",
        share_message: "I've been working with Interstellar Strategies on my website and marketing. If you want the same for your business, book a free call here: {link}",
        booked: { title: "Bonus Google post pack", detail: "4 extra Google Business Profile posts written and published for your business.", value: 200 },
        signed: { title: "$500 account credit", detail: "Applied to your next invoice, or swapped for a free month of care. Your pick.", value: 500 },
        tiers: [
          { name: "Prestige I", threshold: 1, unlock: "Custom landing page", detail: "A conversion-built landing page for an offer, a service or a campaign.", value: 1500 },
          { name: "Prestige II", threshold: 3, unlock: "Automation build", detail: "An automation that takes a recurring task off your plate: lead capture, follow-up, review requests or intake.", value: 3000 },
          { name: "Prestige III", threshold: 5, unlock: "Mini app", detail: "A focused custom app: a calculator, booking tool, internal dashboard or client tool.", value: 5000 },
          { name: "Prestige IV", threshold: 10, unlock: "Full custom app", detail: "A full custom application with backend, database and integrations, built around how you run.", value: 10000 },
          { name: "Prestige Master", threshold: 25, unlock: "VIP partner status", detail: "Partner status: priority build queue, first access to every new system, and your name on the Prestige wall.", value: 0 },
        ],
        terms: "Rewards are earned per referral: one when they book a call, one when they sign. Tier unlocks are counted on signed referrals and stack. A referral counts as signed once their first invoice is paid. Credits apply to Interstellar work, have no cash value and are non-transferable.",
      };
      const setRows = await db.AppSettings.filter({ key: "prestige_offer" }, "-created_date", 1).catch(() => []);
      const saved = ((setRows || [])[0]?.prestigeOffer || {}) as Record<string, any>;
      const offer = { ...DEF, ...saved, booked: { ...DEF.booked, ...(saved.booked || {}) }, signed: { ...DEF.signed, ...(saved.signed || {}) }, tiers: (Array.isArray(saved.tiers) && saved.tiers.length ? saved.tiers : DEF.tiers).slice().sort((a: any, b: any) => (a.threshold || 0) - (b.threshold || 0)) };
      const emails = ((client.portal_emails as string[]) || []).map((e) => String(e).toLowerCase());
      const allMembers = await db.PrestigeMember.list("-created_date", 500).catch(() => []);
      let member = (allMembers || []).find((m: Record<string, unknown>) => m.client_id === cid)
        || (allMembers || []).find((m: Record<string, unknown>) => (!m.client_id || m.client_id === cid) && m.email && emails.includes(String(m.email).toLowerCase()))
        || null;
      const slug = (s: unknown) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "friend";

      if (action === "prestige_join") {
        if (!member) {
          member = await db.PrestigeMember.create({ name: client.business, email: user.role === "admin" ? (emails[0] || "") : user.email, client_id: cid, prestige: "Recruit", totalReferrals: 0, joinDate: new Date().toISOString().slice(0, 10), active: true, referral_code: slug(client.business), last_celebrated_tier: 0, client_celebrated_tier: 0, notes: "Joined from the client portal." });
        } else if (!member.client_id) {
          member = await db.PrestigeMember.update(member.id, { client_id: cid });
        }
      }
      if (!member) return Response.json({ member: null, offer });

      const refs = await db.PrestigeReferral.filter({ memberId: member.id }, "-date", 500).catch(() => []);
      const signed = (refs || []).filter((r: Record<string, unknown>) => r.status === "Confirmed" || r.status === "Paid Out").length;
      const booked = (refs || []).filter((r: Record<string, unknown>) => ["Booked", "Confirmed", "Paid Out"].includes(String(r.status))).length;
      let tier = 0;
      offer.tiers.forEach((t: any, i: number) => { if (signed >= Number(t.threshold || 0)) tier = i + 1; });

      if (action === "prestige_seen") {
        const seen = Math.min(tier, Math.max(0, Math.round(Number(args.tier) || 0)));
        if (user.role !== "admin" && seen > Number(member.client_celebrated_tier || 0)) await db.PrestigeMember.update(member.id, { client_celebrated_tier: seen });
        return Response.json({ ok: true });
      }

      const rewards = await db.PrestigeReward.filter({ memberId: member.id }, "-created_date", 500).catch(() => []);
      const code = (member.referral_code as string) || slug(member.name);
      const base = String(offer.referral_base_url || DEF.referral_base_url);
      const link = `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(code)}`;
      return Response.json({
        offer,
        link,
        share_text: String(offer.share_message || "").replace(/\{link\}/g, link).replace(/\{name\}/g, String(member.name || "")),
        member: { id: member.id, name: member.name, signed, booked, sent: (refs || []).length, tier, celebrated: Number(member.client_celebrated_tier || 0) },
        referrals: (refs || []).map((r: Record<string, unknown>) => pick(r, ["id", "referredClientName", "status", "date"])),
        rewards: (rewards || []).filter((r: Record<string, unknown>) => r.status !== "void").map((r: Record<string, unknown>) => pick(r, ["id", "kind", "title", "value", "status", "earned_at", "delivered_at", "referredClientName", "tier_index"])),
      });
    }

    // ---- Email signatures: the client's own signatures + templates, plus Interstellar's global templates ----
    const SIG_KEYS = ["id", "name", "template_id", "fields", "theme", "generated_html", "folder", "client_id", "source_template_id", "updated_date", "created_by"];
    const TPL_KEYS = ["id", "name", "description", "folder", "scope", "client_id", "is_default", "template_id", "fields", "theme", "preview_html", "updated_date"];
    const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const tooBig = (v: unknown) => JSON.stringify(v || {}).length > 400000;
    const clean = (a: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      if (a.name !== undefined) out.name = String(a.name || "Untitled").slice(0, 120);
      if (a.folder !== undefined) out.folder = String(a.folder || "").slice(0, 80);
      if (a.template_id !== undefined) out.template_id = String(a.template_id || "t5_rail").slice(0, 40);
      if (a.fields !== undefined) out.fields = obj(a.fields);
      if (a.theme !== undefined) out.theme = obj(a.theme);
      return out;
    };
    const ownSig = async (id: unknown) => {
      const s = id ? await db.Signature.get(String(id)).catch(() => null) : null;
      return s && s.client_id === cid ? s : null;
    };
    const ownTpl = async (id: unknown) => {
      const t = id ? await db.SignatureTemplate.get(String(id)).catch(() => null) : null;
      return t && t.scope === "client" && t.client_id === cid ? t : null;
    };

    if (action === "sig_list") {
      const [sigs, own, global, dossiers] = await Promise.all([
        db.Signature.filter({ client_id: cid }, "-updated_date", 300),
        db.SignatureTemplate.filter({ client_id: cid, scope: "client" }, "-updated_date", 200),
        db.SignatureTemplate.filter({ scope: "global" }, "-updated_date", 200),
        db.ClientDossier.filter({ client_id: cid }).catch(() => []),
      ]);
      const d = (dossiers || [])[0] || {};
      const bi = (d.brand_identity || {}) as Record<string, unknown>;
      return Response.json({
        signatures: (sigs || []).map((s: Record<string, unknown>) => pick(s, SIG_KEYS)),
        templates: [...(own || []), ...(global || []).filter((t: Record<string, unknown>) => t.portal_visible !== false)].map((t: Record<string, unknown>) => pick(t, TPL_KEYS)),
        brand: { company: client.business, website: client.domain, logo_url: client.logo_url || bi.logo_url || "", slogan: d.tagline || "", colors: bi.colors || [] },
      });
    }

    if (action === "sig_get") {
      const s = await ownSig(args.id);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ signature: pick(s, SIG_KEYS) });
    }

    if (action === "sig_save") {
      const data = clean(args);
      if (args.generated_html !== undefined) data.generated_html = String(args.generated_html || "").slice(0, 200000);
      if (args.source_template_id) data.source_template_id = String(args.source_template_id);
      if (tooBig(data.fields) || tooBig(data.theme)) return Response.json({ error: "Signature is too large" }, { status: 413 });
      if (args.id) {
        const s = await ownSig(args.id);
        if (!s) return Response.json({ error: "Not found" }, { status: 404 });
        const u = await db.Signature.update(s.id, data);
        return Response.json({ signature: pick(u, SIG_KEYS) });
      }
      const c = await db.Signature.create({ name: "Untitled signature", template_id: "t5_rail", ...data, client_id: cid, client_name: client.business });
      return Response.json({ signature: pick(c, SIG_KEYS) });
    }

    if (action === "sig_delete") {
      const s = await ownSig(args.id);
      if (!s) return Response.json({ error: "Not found" }, { status: 404 });
      await db.Signature.delete(s.id);
      return Response.json({ ok: true });
    }

    if (action === "tpl_get") {
      const t = args.id ? await db.SignatureTemplate.get(String(args.id)).catch(() => null) : null;
      const ok = t && ((t.scope === "client" && t.client_id === cid) || (t.scope === "global" && t.portal_visible !== false));
      if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ template: pick(t, TPL_KEYS) });
    }

    if (action === "tpl_save") {
      const data = clean(args);
      if (args.preview_html !== undefined) data.preview_html = String(args.preview_html || "").slice(0, 200000);
      if (args.is_default === false) data.is_default = false;
      if (tooBig(data.fields) || tooBig(data.theme)) return Response.json({ error: "Template is too large" }, { status: 413 });
      if (args.id) {
        const t = await ownTpl(args.id);
        if (!t) return Response.json({ error: "Only your own templates can be edited" }, { status: 403 });
        const u = await db.SignatureTemplate.update(t.id, data);
        return Response.json({ template: pick(u, TPL_KEYS) });
      }
      const c = await db.SignatureTemplate.create({ name: "Untitled template", template_id: "t5_rail", ...data, scope: "client", client_id: cid, client_name: client.business, is_default: false });
      return Response.json({ template: pick(c, TPL_KEYS) });
    }

    if (action === "tpl_default") {
      const t = await ownTpl(args.id);
      if (!t) return Response.json({ error: "Only your own templates can be the default" }, { status: 403 });
      const mine = await db.SignatureTemplate.filter({ client_id: cid, scope: "client", is_default: true });
      await Promise.all((mine || []).filter((x: Record<string, unknown>) => x.id !== t.id).map((x: Record<string, unknown>) => db.SignatureTemplate.update(x.id as string, { is_default: false })));
      const u = await db.SignatureTemplate.update(t.id, { is_default: true });
      return Response.json({ template: pick(u, TPL_KEYS) });
    }

    if (action === "tpl_delete") {
      const t = await ownTpl(args.id);
      if (!t) return Response.json({ error: "Only your own templates can be deleted" }, { status: 403 });
      await db.SignatureTemplate.delete(t.id);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message || "Server error" }, { status: 500 });
  }
});

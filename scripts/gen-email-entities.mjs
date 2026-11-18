// One-off generator for the client Email Studio entities (Nov 2026 upgrade). Run: node scripts/gen-email-entities.mjs
// Every entity is admin-only RLS: portal users reach them only through the email-client / public email functions,
// which scope every read and write to the caller's own client.
import { writeFileSync } from "node:fs";

const RLS = { create: { user_condition: { role: "admin" } }, read: { user_condition: { role: "admin" } }, update: { user_condition: { role: "admin" } }, delete: { user_condition: { role: "admin" } } };
const s = (description, extra = {}) => ({ type: "string", ...(description ? { description } : {}), ...extra });
const dt = (description) => ({ type: "string", format: "date-time", ...(description ? { description } : {}) });
const n = (description, d = 0) => ({ type: "number", default: d, ...(description ? { description } : {}) });
const b = (description, d = false) => ({ type: "boolean", default: d, ...(description ? { description } : {}) });
const arr = (description, items = { type: "string" }) => ({ type: "array", items, ...(description ? { description } : {}) });
const obj = (description) => ({ type: "object", additionalProperties: true, ...(description ? { description } : {}) });
const en = (values, d, description) => ({ type: "string", enum: values, default: d, ...(description ? { description } : {}) });

const ents = {
  EmailContact: {
    description: "Client Email Studio contacts (one row per client + email). Admin-only RLS; portal users reach them only through the email-client function, scoped to their own client. Never mixed with Interstellar's own EmailSubscriber list.",
    properties: {
      client_id: s("CRMClient id"), email: s("Lowercased; unique per client", { format: "email" }),
      first_name: s(), last_name: s(), name: s("Display name"), phone: s(),
      list_ids: arr("EmailContactList ids"), tags: arr("Lowercased tags"),
      city: s(), state: s(), zip: s(), country: s(), timezone: s("IANA time zone, e.g. America/Los_Angeles (send-in-their-time-zone)"),
      birthday: s("MM-DD or YYYY-MM-DD"), anniversary: s("YYYY-MM-DD (customer since / anniversary)"),
      fields: obj("Custom fields { key: string }"),
      status: en(["subscribed", "pending", "unsubscribed", "cleaned"], "subscribed", "pending = waiting for double opt-in; cleaned = hard bounce / complaint"),
      source: s("import | form | webhook | manual"), source_detail: s("File name, form name or event"),
      consent: obj("{ basis: express | existing_customer | double_opt_in, source, text, at, by, ip_hash }"),
      confirmed_at: dt(), created_at: dt(), unsubscribed_at: dt(),
      last_sent_at: dt(), last_opened_at: dt(), last_clicked_at: dt(),
      sent_count: n(), open_count: n(), click_count: n(),
      test: b("Labeled QA/demo contact (example.com). Never really sent."),
    },
    required: ["client_id", "email"],
  },
  EmailContactList: {
    description: "A client's Email Studio list (audience). Contacts point at lists via EmailContact.list_ids.",
    properties: { client_id: s(), name: s(), description: s(), contact_count: n("Cached count, refreshed by email-client"), created_at: dt(), test: b() },
    required: ["client_id", "name"],
  },
  EmailSegment: {
    description: "Saved segment for a client's Email Studio: rules over contact fields and engagement, evaluated server-side (base44/shared/emailCore.ts matchSegment).",
    properties: {
      client_id: s(), name: s(), match: en(["all", "any"], "all"),
      rules: arr("[{ field, op, value, key? }] see SEGMENT_FIELDS in emailCore.ts", { type: "object", additionalProperties: true }),
      last_count: n(), last_counted_at: dt(), test: b(),
    },
    required: ["client_id", "name"],
  },
  EmailEvent: {
    description: "Email Studio engagement: one row per open / click / bounce / complaint / unsubscribe. rid = opaque recipient id (contact id, or a keyed hash of the address). No PII in tracking URLs; email is stored here only.",
    properties: {
      client_id: s(), campaign_id: s(), automation_id: s(), step_id: s(), rid: s(), contact_id: s(), email: s(),
      type: en(["open", "click", "bounce", "complaint", "unsubscribe"], "open"),
      url: s(), link_index: n("Index into the campaign / step link list", -1), machine: b("Likely a link scanner / proxy, not a person"), ua: s("Shortened user agent"), at: dt(),
    },
    required: ["client_id", "type"],
  },
  EmailSignupForm: {
    description: "Embeddable sign-up form for a client's Email Studio list. form_key is the public id in the embed (not a secret). Public submissions go through the email-signup function (rate limited, honeypot, optional double opt-in).",
    properties: {
      client_id: s(), name: s(), list_id: s(), tags: arr(), double_opt_in: b("Send a confirm link before the contact is subscribed", true),
      fields: arr("Extra fields shown: first_name, last_name, phone, birthday, zip"),
      heading: s(), intro: s(), button_label: s(), consent_text: s("Shown next to the required consent checkbox"), success_message: s(), redirect_url: s(),
      form_key: s("Public form id used in the embed"), status: en(["active", "paused"], "active"),
      submissions: n(), confirmations: n(), last_submission_at: dt(), test: b(),
    },
    required: ["client_id", "name"],
  },
  EmailAutomation: {
    description: "Client Email Studio automation: a trigger plus steps (email / wait). Processed by email-bulk drain (every 5 minutes). Triggers: list_join, event (signed webhook from the client's Command System, see AUTOMATION-TRIGGER-CONTRACT.md), inactive (X months), date_field (birthday / anniversary).",
    properties: {
      client_id: s(), name: s(), kind: s("welcome | review_request | win_back | birthday | anniversary | custom"),
      trigger: obj("{ type: list_join | event | inactive | date_field, list_id?, event_name?, months?, field?: birthday | anniversary, send_hour? }"),
      steps: arr("[{ id, type: email | wait, wait_value, wait_unit: hours | days, subject, blocks }]", { type: "object", additionalProperties: true }),
      status: en(["draft", "active", "paused"], "draft"), reenroll_days: n("0 = once per contact (per year for date triggers)", 0),
      enrolled_count: n(), completed_count: n(), last_scan_day: s("YYYY-MM-DD of the last daily scan (inactive / date triggers)"),
      stats: obj("Cached per-step stats { step_id: { sent, opens, unique_opens, clicks, unique_clicks } }"), stats_at: dt(),
      paused_at: dt(), activated_at: dt(), test: b(),
    },
    required: ["client_id", "name"],
  },
  EmailEnrollment: {
    description: "One contact moving through one EmailAutomation. trigger_key makes enrollment idempotent per automation + contact.",
    properties: {
      client_id: s(), automation_id: s(), contact_id: s(), email: s(), step_index: n(), next_run_at: dt(),
      status: en(["active", "done", "exited", "failed"], "active"), exit_reason: s(), trigger_key: s(), data: obj("Event fields available as merge tags"),
      history: arr("[{ step_id, at, result }]", { type: "object", additionalProperties: true }), started_at: dt(), finished_at: dt(), test: b(),
    },
    required: ["client_id", "automation_id"],
  },
  EmailStudioSettings: {
    description: "Per-client Email Studio settings: CAN-SPAM mailing address, time zone, review link, brand overrides and the NAME of the automation trigger secret (value set by Justin in app secrets).",
    properties: {
      client_id: s(), physical_address: s("Postal address shown in every email footer (CAN-SPAM)"), timezone: s("IANA zone for scheduling"),
      review_link: s("Used by {{review_link}}"), from_name: s(), reply_to: s(), footer_note: s(),
      brand: obj("{ logo_url, primary, accent, text, background, font } overrides; empty = from the brand kit"),
      trigger_secret_name: s("App secret NAME holding this client's webhook signing key, e.g. EMAIL_TRIGGER_KEY_SUMMIT"),
      default_list_id: s(), test: b(),
    },
    required: ["client_id"],
  },
};

for (const [name, e] of Object.entries(ents)) {
  const out = { name, type: "object", description: e.description, properties: e.properties, required: e.required, rls: RLS };
  writeFileSync(new URL(`../base44/entities/${name}.jsonc`, import.meta.url), JSON.stringify(out, null, 2) + "\n");
}
console.log("wrote", Object.keys(ents).join(", "));

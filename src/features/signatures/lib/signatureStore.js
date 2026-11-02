// Where signatures and templates are loaded from / saved to.
// adminStore: Møthership admins, straight to entities.
// portalStore(call): client portal users, through the `portal` backend function
// (portal users never touch entities directly; the function scopes everything to their client).
import { base44 } from "@/api/base44Client";
import { normalize } from "./signatureTemplates";

// Person-specific details a template never carries into a new signature.
const PERSON = {
  full_name: "Your Name",
  job_title: "Your Title",
  phone: "",
  email: "",
  profile_photo_url: "",
};

const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());
const NEUTRAL = /^#(f{6}|0{6}|1c1c1c|111111|141414|f0f0eb|f7eee0|fbf7ef)$/i;

// Starting fields/theme for a new signature: the template design, minus the person.
// `brand` (portal / client folder) fills the company line and brand colours.
export function startFrom(template, brand) {
  const { f, t } = normalize(template?.fields || {}, template?.theme || {});
  const fields = { ...f, ...PERSON, assets: f.assets || {} };
  const theme = { ...t };
  if (brand) {
    if (brand.company && !fields.company_name) fields.company_name = brand.company;
    if (brand.logo_url && !fields.logo_url) fields.logo_url = brand.logo_url;
    if (brand.website && !fields.website) {
      fields.website = brand.website;
      fields.website_show = true;
    }
    if (brand.slogan && !fields.slogan) fields.slogan = brand.slogan;
    const colors = (brand.colors || []).map((x) => (typeof x === "string" ? x : x?.hex)).filter(isHex);
    const accent = colors.find((x) => !NEUTRAL.test(x));
    if (accent && brand.applyColors) {
      const old = [t.accent_color, t.accent_color_2].map((c) => String(c || "").toLowerCase());
      theme.accent_color = accent;
      theme.accent_color_2 = colors.find((x) => x !== accent && !NEUTRAL.test(x)) || accent;
      // Contact icons that followed the old accent follow the new one too.
      if (old.includes(String(theme.contact_icon_color || "").toLowerCase())) theme.contact_icon_color = theme.accent_color_2;
    }
  }
  return { fields, theme, template_id: template?.template_id || "t5_rail" };
}

// A template made from a finished signature, scrubbed for reuse by anyone
// (used when the template is global — company-specific links are cleared).
export function scrubForGlobal(fields) {
  const social = Object.fromEntries(Object.entries(fields.social || {}).map(([k, v]) => [k, { show: !!v?.show, url: "" }]));
  return {
    ...fields,
    ...PERSON,
    company_name: "",
    slogan: "",
    logo_url: "",
    website: "",
    address: "",
    social,
    cta: { ...(fields.cta || {}), url: "" },
    assets: {},
  };
}

export const brandFromClient = async (client) => {
  if (!client) return null;
  let d = null;
  try {
    [d] = await base44.entities.ClientDossier.filter({ client_id: client.id });
  } catch {
    /* none */
  }
  return {
    company: client.business,
    website: client.domain,
    logo_url: d?.brand_identity?.logo_url || client.logo_url,
    slogan: d?.tagline,
    colors: d?.brand_identity?.colors,
    applyColors: true,
  };
};

const E = () => base44.entities;

export const adminStore = {
  kind: "admin",
  listSignatures: () => E().Signature.list("-updated_date", 500),
  listTemplates: () => E().SignatureTemplate.list("-updated_date", 500),
  listClients: () => E().CRMClient.list("business", 300).then((l) => (l || []).filter((c) => c.business)),
  getSignature: (id) => E().Signature.get(id),
  saveSignature: (id, payload) => (id ? E().Signature.update(id, payload) : E().Signature.create(payload)),
  deleteSignature: (id) => E().Signature.delete(id),
  getTemplate: (id) => E().SignatureTemplate.get(id),
  saveTemplate: (id, payload) => (id ? E().SignatureTemplate.update(id, payload) : E().SignatureTemplate.create(payload)),
  deleteTemplate: (id) => E().SignatureTemplate.delete(id),
  // Client default beats the global default.
  async defaultTemplate(clientId) {
    const all = await E().SignatureTemplate.filter({ is_default: true });
    return (clientId && all.find((t) => t.scope === "client" && t.client_id === clientId)) || all.find((t) => t.scope === "global") || null;
  },
  async setDefault(tpl) {
    const all = await E().SignatureTemplate.filter({ is_default: true });
    const same = all.filter((t) => t.id !== tpl.id && t.scope === tpl.scope && (tpl.scope === "global" || t.client_id === tpl.client_id));
    await Promise.all(same.map((t) => E().SignatureTemplate.update(t.id, { is_default: false })));
    return E().SignatureTemplate.update(tpl.id, { is_default: true });
  },
  async brand(clientId) {
    if (!clientId) return null;
    const c = await E().CRMClient.get(clientId).catch(() => null);
    return brandFromClient(c);
  },
};

export function portalStore(call) {
  const cache = {};
  const list = async () => {
    const r = await call("sig_list");
    cache.brand = r.brand;
    return r;
  };
  return {
    kind: "portal",
    listSignatures: async () => (await list()).signatures || [],
    listTemplates: async () => (await list()).templates || [],
    listClients: async () => [],
    getSignature: async (id) => (await call("sig_get", { id })).signature,
    saveSignature: async (id, payload) => (await call("sig_save", { id, ...payload })).signature,
    deleteSignature: (id) => call("sig_delete", { id }),
    getTemplate: async (id) => (await call("tpl_get", { id })).template,
    saveTemplate: async (id, payload) => (await call("tpl_save", { id, ...payload })).template,
    deleteTemplate: (id) => call("tpl_delete", { id }),
    async defaultTemplate() {
      const r = await list();
      const t = r.templates || [];
      return t.find((x) => x.scope === "client" && x.is_default) || t.find((x) => x.scope === "global" && x.is_default) || null;
    },
    setDefault: (tpl) => call("tpl_default", { id: tpl.id }),
    async brand() {
      if (!cache.brand) await list();
      return cache.brand ? { ...cache.brand, applyColors: true } : null;
    },
  };
}

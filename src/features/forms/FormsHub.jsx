import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardList, Copy, Eye, Globe, Inbox, Layers, Pencil, Plane, Plus, RotateCcw, Search, Trash2, UserPlus, Workflow } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { Tag, SmallBtn, Btn } from "@/features/clients/ui";
import { FormEditor } from "@/features/requests/FormBuilder";
import RequestFormRenderer from "@/features/requests/RequestFormRenderer";
import { REQUEST_TYPES, STANDARD_FORMS, KIND_LABELS, INDUSTRY_LABELS, buildDefaultForms, portalForms } from "@/features/requests/formSchema";
import { INTAKE_SECTIONS, ALL_QUESTIONS } from "@/features/clients/intakeQuestions";
import { STEPS } from "@/features/flight/onboarding/catalog";
import { packageByKey, packagePath } from "@/features/packages/registry";
import NewLeadDialog from "@/features/pipeline/NewLeadDialog";
import { sourceOf, isLeadish } from "@/features/pipeline/pipeline";
import TemplateFormsList from "./TemplateForms";

const SUBTABS = [
  { key: "lead", label: "Lead capture", icon: Inbox, what: "How new leads reach Møthership. Used before the sale: every submission becomes a lead on the Pipeline." },
  { key: "onboarding", label: "Onboarding intake", icon: Plane, what: "What a client fills in after they pay, in their portal. Used once per client to collect everything the build needs." },
  { key: "requests", label: "Request forms", icon: ClipboardList, what: "What active clients submit through their portal (or a public link) for ongoing work. Pick a client to see exactly what they see." },
];

const FLIGHT_INTAKE = /^Onboarding intake for the flight plan/;
const randKey = () => Array.from(crypto.getRandomValues(new Uint8Array(18))).map((b) => b.toString(16).padStart(2, "0")).join("");
const strip = (f) => {
  const { id: _id, created_date: _c, updated_date: _u, created_by: _b, created_by_id: _bi, is_sample: _s, ...d } = f;
  return d;
};

// Which package a shared intake template is for (FormTemplate has no package field; matched by title).
const INTAKE_APPLIES = [
  [/ignition/i, "Every new build after payment: Mission ALPHA, Mission BRAVO, Custom Website, Command System. Brand + business basics."],
  [/^interstellar$/i, "General new-customer intake (pre-flight-plan); superseded by the portal intake + flight plan checklist."],
  [/app|system|ørigin|origin/i, "Command System (Ørigin) builds and Mission ALPHA / BRAVO."],
  [/seo|hypercare|orbit|ørbit/i, "HyperCare+ subscriptions."],
];
const intakeAppliesTo = (form) => (INTAKE_APPLIES.find(([re]) => re.test(form.title || "")) || [null, "All packages (no package rule set)."])[1];

/* ------------------------------------------------------------------ */
/* 1. Lead capture                                                     */
/* ------------------------------------------------------------------ */
function LeadCapture() {
  const navigate = useNavigate();
  const clients = useList("CRMClient", { sort: "-created_date", limit: 1000 });
  const [open, setOpen] = useState(false);
  const counts = useMemo(() => {
    const now = new Date();
    const leads = (clients.data || []).filter(isLeadish);
    const by = (src) => {
      const rows = leads.filter((c) => sourceOf(c) === src);
      const month = rows.filter((c) => {
        const d = new Date(c.created_date || 0);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;
      return { all: rows.length, month };
    };
    const manual = leads.filter((c) => !["website", "funnel"].includes(sourceOf(c)));
    return { website: by("website"), funnel: by("funnel"), manual: manual.length };
  }, [clients.data]);

  const cards = [
    {
      icon: Globe, title: "Website booking form", where: "interstellar-strategies.com", source: "website", count: counts.website,
      steps: ["You: name, email, phone", "Your business: business, website, industry, annual revenue, interest, timeline, biggest problem", "Pick a time: strategy call slot + Google Meet"],
      flow: "Website `booking` function → lead-intake (start / business / book). Creates the lead as New, moves it to Call booked when a time is picked and adds a P1 sales task on the call date.",
    },
    {
      icon: Workflow, title: "Booking funnel", where: "interstellar-booking.com (Interstellar Booking app)", source: "funnel", count: counts.funnel,
      steps: ["Same three steps and fields as the website form", "Sends source \"funnel\", the funnel name and UTM tags"],
      flow: "Funnel app → the same lead-intake function. The funnel name shows on the lead card and in the Pipeline source filter.",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.title} className="rounded-md border border-hair bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#ff3c00]/10"><Icon className="h-4 w-4 text-[#ff3c00]" /></span>
                  <div>
                    <p className="text-[14.5px] font-semibold tracking-[-0.02em]">{c.title}</p>
                    <p className="text-[11.5px] text-ink/50">{c.where}</p>
                  </div>
                </div>
                <Tag tone="muted">Read only</Tag>
              </div>
              <ol className="mt-3 space-y-1 text-[12.5px] text-ink/75">
                {c.steps.map((s, i) => <li key={s}><span className="mr-1.5 font-mono text-[10.5px] text-[#ff3c00]">{i + 1}</span>{s}</li>)}
              </ol>
              <p className="mt-3 text-[12px] leading-relaxed text-ink/55">{c.flow}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
                <p className="text-[12px] text-ink/60"><span className="font-mono text-ink">{c.count.month}</span> this month · <span className="font-mono text-ink">{c.count.all}</span> all time · source <code className="font-mono text-[11px]">{c.source}</code></p>
                <Link to="/pipeline" className="inline-flex items-center gap-1 text-[12px] font-medium text-[#ff3c00] hover:underline">Goes to Pipeline <ArrowRight className="h-3 w-3" /></Link>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-hair bg-card/60 p-5">
        <div>
          <p className="text-[14px] font-semibold">Manual new lead</p>
          <p className="text-[12px] text-ink/55">Referrals, cold approach, ads, social. Same questions as the website form, plus source and referrer (links a Prestige member). {counts.manual} on file.</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#ff3c00] px-3 text-[12px] font-medium text-white hover:bg-ink"><UserPlus className="h-3.5 w-3.5" /> New lead</button>
      </div>
      <NewLeadDialog open={open} onOpenChange={setOpen} onCreated={() => navigate("/pipeline")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Onboarding intake                                                */
/* ------------------------------------------------------------------ */
function OnboardingIntake({ templates, setTemplates }) {
  const audits = useList("IntakeAudit", { sort: "-created_date", limit: 500 });
  const forms = useList("RequestForm", { sort: "-updated_date", limit: 500 });
  const flights = useList("OnboardingFlight", { sort: "-updated_date", limit: 300 });
  const checklists = (forms.data || []).filter((f) => FLIGHT_INTAKE.test(f.claude_instructions || ""));
  const flightByForm = Object.fromEntries((flights.data || []).filter((f) => f.intake_form_id).map((f) => [f.intake_form_id, f]));
  const submitted = (audits.data || []).filter((a) => a.status === "submitted" || a.submitted_at).length;
  const inProgress = (audits.data || []).length - submitted;
  const strategyStep = STEPS.find((s) => s.id === "deal");

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-hair bg-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[14.5px] font-semibold tracking-[-0.02em]">Client intake (portal)</p>
              <p className="text-[12px] text-ink/55">The questionnaire every client sees in their portal after they pay. Answers save to their Intake Audit, which every Claude brief reads.</p>
            </div>
            <Tag tone="flame">All packages</Tag>
          </div>
          <p className="mt-3 text-[12px] text-ink/60">{INTAKE_SECTIONS.length} sections · {ALL_QUESTIONS.length} questions · <span className="font-mono">{submitted}</span> submitted · <span className="font-mono">{inProgress}</span> in progress</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {INTAKE_SECTIONS.map((s) => (
              <li key={s.id} className="rounded-sm border border-hair bg-paper px-2 py-1 text-[11.5px]">
                {s.title} <span className="font-mono text-[10px] text-ink/45">{s.questions.length}</span>
                {/system/i.test(s.title) ? <span className="ml-1 text-[10px] text-[#c24100]">Command System · ALPHA · BRAVO</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-ink/50">Edited in code (src/features/clients/intakeQuestions.js) so the portal, the audit and the flight plan stay in sync.</p>
        </div>

        <div className="rounded-md border border-hair bg-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[14.5px] font-semibold tracking-[-0.02em]">Flight plan combined intake</p>
              <p className="text-[12px] text-ink/55">Built per client right after step {strategyStep ? strategyStep.num : 2} of the flight plan: one request with only what&apos;s still missing for the package sold (assets, access invites, goals). Answers flow back into the flight plan and the Intake Audit.</p>
            </div>
            <Tag tone="ink">Per package</Tag>
          </div>
          {checklists.length ? (
            <ul className="mt-3 divide-y divide-hair rounded-md border border-hair">
              {checklists.slice(0, 12).map((f) => {
                const fl = flightByForm[f.id];
                const pkg = fl ? packageByKey(fl.package_key) : null;
                return (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]">
                    <span className="min-w-0"><span className="font-medium">{f.client_name}</span> <span className="text-ink/50">· {f.title} · {(f.fields || []).length} questions · {f.submissions || 0} answered</span></span>
                    {pkg ? <Link to={packagePath(pkg.key) + "/" + f.client_id} className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline">{pkg.label} flight <ArrowRight className="h-3 w-3" /></Link> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-hair px-3 py-4 text-center text-[12px] text-ink/50">None sent yet. Send one from a client&apos;s flight plan (Deal step).</p>
          )}
        </div>
      </div>

      <div>
        <p className="mono-label mb-1 text-[9.5px] text-ink/50">Shared intake templates</p>
        <p className="mb-3 text-[12px] text-ink/55">Standalone intake forms (e.g. the Interstellar Ignition Form). Each card shows the packages it applies to.</p>
        <TemplateFormsList forms={templates} setForms={setTemplates} formType="intake" appliesTo={intakeAppliesTo} emptyText="No shared intake templates yet." />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Request forms                                                    */
/* ------------------------------------------------------------------ */
const typeByKind = (k) => REQUEST_TYPES.find((t) => t.kind === k) || null;

function PreviewBox({ form, onClose }) {
  const [vals, setVals] = useState({});
  return (
    <div className="rounded-md border border-hair bg-card">
      <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
        <p className="text-[13px] font-semibold">{form.title} <span className="font-normal text-ink/45">· preview</span></p>
        <SmallBtn onClick={onClose}>Close</SmallBtn>
      </div>
      <div className="px-4 py-4"><RequestFormRenderer form={form} vals={vals} onChange={(k, v) => setVals((s) => ({ ...s, [k]: v }))} /></div>
    </div>
  );
}

function UniversalForms({ customForms, templates, setTemplates }) {
  const [preview, setPreview] = useState(null);
  const overrides = (kind) => customForms.filter((f) => f.kind === kind && f.active !== false && !FLIGHT_INTAKE.test(f.claude_instructions || "")).length;
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[18px] font-semibold tracking-[-0.03em]">Universal forms</p>
        <p className="text-[12px] text-ink/55">The standard set every client sees in their portal. A client-specific copy of the same type replaces the standard one for that client only. Defined in src/features/requests/formSchema.js.</p>
      </div>
      {preview ? <PreviewBox form={preview} onClose={() => setPreview(null)} /> : null}
      <ul className="divide-y divide-hair rounded-md border border-hair bg-card">
        {STANDARD_FORMS.map((f) => {
          const n = overrides(f.kind);
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Tag tone="ink">{KIND_LABELS[f.kind]}</Tag><span className="text-[13.5px] font-medium">{f.title}</span></div>
                <p className="mt-0.5 text-[11.5px] text-ink/50">{(f.fields || []).length} questions{typeByKind(f.kind)?.base ? " · in default client setup" : ""}{n ? ` · overridden for ${n} client${n === 1 ? "" : "s"}` : ""}</p>
              </div>
              <SmallBtn onClick={() => setPreview(f)}><Eye className="h-3 w-3" /> Preview</SmallBtn>
            </li>
          );
        })}
      </ul>
      <div>
        <p className="mono-label mb-1 text-[9.5px] text-ink/50">Legacy shared request templates</p>
        <p className="mb-3 text-[12px] text-ink/55">Older shared FormTemplate request forms (Førge, Web Øps). Not shown in client portals; kept editable.</p>
        <TemplateFormsList forms={templates} setForms={setTemplates} formType="request" emptyText="No legacy request templates." />
      </div>
    </div>
  );
}

function ClientForms({ client, customForms, onChanged }) {
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [industry, setIndustry] = useState("services");
  const [busy, setBusy] = useState(false);
  const mine = customForms.filter((f) => f.client_id === client.id);
  const visible = portalForms(mine);
  const visibleIds = new Set(visible.map((f) => f.id));
  const hidden = mine.filter((f) => !visibleIds.has(f.id));
  const refresh = () => { invalidate("RequestForm"); onChanged && onChanged(); };

  const customize = (std) => {
    const t = typeByKind(std.kind) || {};
    setEditing({ client_id: client.id, client_name: client.business, kind: std.kind, title: std.title, intro: std.intro || "", fields: (std.fields || []).map((x) => ({ ...x })), claude_instructions: t.claude_instructions || "", publish_target: "", active: true, submissions: 0 });
  };
  const remove = async (f) => { await base44.entities.RequestForm.delete(f.id); setConfirm(null); refresh(); };
  const duplicate = async (f) => { await base44.entities.RequestForm.create({ ...strip(f), title: f.title + " (copy)", form_key: randKey(), submissions: 0 }); refresh(); };
  const seed = async () => {
    setBusy(true);
    try {
      const defaults = buildDefaultForms(client, industry).filter((d) => !mine.some((m) => m.kind === d.kind)).map((d) => ({ ...d, form_key: randKey() }));
      if (defaults.length) await base44.entities.RequestForm.bulkCreate(defaults);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  if (editing) return <FormEditor form={editing} onSaved={() => { setEditing(null); refresh(); }} onClose={() => setEditing(null)} />;

  const row = (f, kindLabel) => {
    const std = Boolean(f.standard);
    const override = !std && STANDARD_FORMS.some((s) => s.kind === f.kind);
    const flight = !std && FLIGHT_INTAKE.test(f.claude_instructions || "");
    return (
      <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={std ? "muted" : f.active === false ? "muted" : "flame"}>{kindLabel || KIND_LABELS[f.kind] || f.kind}</Tag>
            <span className="text-[13.5px] font-medium">{f.title}</span>
            {std ? <span className="mono-label text-[8.5px] text-ink/45">Standard</span> : flight ? <span className="mono-label text-[8.5px] text-[#c24100]">Flight plan intake</span> : override ? <span className="mono-label text-[8.5px] text-[#c24100]">Override for {client.business}</span> : <span className="mono-label text-[8.5px] text-[#c24100]">Custom</span>}
            {f.active === false ? <Tag tone="amber">Inactive</Tag> : null}
          </div>
          <p className="mt-0.5 text-[11.5px] text-ink/50">{(f.fields || []).length} questions{std ? "" : ` · ${f.submissions || 0} submitted`}{f.publish_target ? ` · → ${f.publish_target}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <SmallBtn onClick={() => setPreview(f)} title="Preview"><Eye className="h-3 w-3" /></SmallBtn>
          {std ? (
            <SmallBtn onClick={() => customize(f)}><Pencil className="h-3 w-3" /> Customize for {client.business}</SmallBtn>
          ) : (
            <>
              <SmallBtn onClick={() => setEditing(f)}><Pencil className="h-3 w-3" /> Edit</SmallBtn>
              <SmallBtn onClick={() => duplicate(f)} title="Duplicate"><Copy className="h-3 w-3" /></SmallBtn>
              {confirm === f.id ? (
                <>
                  <SmallBtn onClick={() => remove(f)} className="!border-red-600/40 !text-red-700">{override ? "Revert" : "Delete"}</SmallBtn>
                  <SmallBtn onClick={() => setConfirm(null)}>Keep</SmallBtn>
                </>
              ) : (
                <SmallBtn onClick={() => setConfirm(f.id)} title={override ? "Revert to the standard form" : "Delete"}>{override ? <RotateCcw className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}</SmallBtn>
              )}
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Everything this client sees</p>
          <h3 className="text-[22px] font-semibold tracking-[-0.03em]">{client.business}</h3>
          <p className="text-[12px] text-ink/55">{visible.length} forms in their portal · {mine.length} client-specific. Custom forms of a standard type replace the standard one.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SmallBtn onClick={() => setEditing({ client_id: client.id, client_name: client.business, kind: "project_submission", title: "", fields: [], active: true, submissions: 0 })}><Plus className="h-3 w-3" /> New custom form</SmallBtn>
          <Link to={`/clients/${client.id}?tab=requests`} className="inline-flex h-7 items-center gap-1 border border-hair bg-paper px-2.5 text-[12px] text-ink/70 hover:border-ink/40">Client page <ArrowRight className="h-3 w-3" /></Link>
        </div>
      </div>

      {preview ? <PreviewBox form={preview} onClose={() => setPreview(null)} /> : null}

      {!mine.some((m) => m.kind === "project_submission") ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-hair bg-card/60 px-4 py-3 text-[12px] text-ink/60">
          No tailored project form yet. Create their default set for
          <select className="border border-hair bg-paper px-2 py-1 text-[12px]" value={industry} onChange={(e) => setIndustry(e.target.value)}>{Object.entries(INDUSTRY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <Btn onClick={seed} disabled={busy}>{busy ? "Creating…" : "Create"}</Btn>
        </div>
      ) : null}

      <ul className="divide-y divide-hair rounded-md border border-hair bg-card">{visible.map((f) => row(f))}</ul>

      {hidden.length ? (
        <div>
          <p className="mono-label mb-1.5 text-[9.5px] text-ink/50">Not in their portal right now (inactive or replaced)</p>
          <ul className="divide-y divide-hair rounded-md border border-hair bg-card">{hidden.map((f) => row(f))}</ul>
        </div>
      ) : null}
    </div>
  );
}

function RequestFormsTab({ templates, setTemplates }) {
  const clientsQ = useList("CRMClient", { sort: "business", limit: 1000 });
  const formsQ = useList("RequestForm", { sort: "client_name", limit: 1000 });
  const [sel, setSel] = useState("__universal__");
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const custom = formsQ.data || [];
  const clients = (clientsQ.data || [])
    .filter((c) => showInactive || c.status !== "Inactive")
    .filter((c) => !q.trim() || String(c.business || "").toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => String(a.business || "").localeCompare(String(b.business || "")));
  const countFor = (c) => {
    const mine = custom.filter((f) => f.client_id === c.id);
    return { total: portalForms(mine).length, custom: mine.length };
  };
  const client = (clientsQ.data || []).find((c) => c.id === sel);

  return (
    <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
      <aside className="rounded-md border border-hair bg-card">
        <button type="button" onClick={() => setSel("__universal__")} className={cn("flex w-full items-center gap-3 border-b border-hair px-4 py-3 text-left hover:bg-[#ff3c00]/[0.04]", sel === "__universal__" && "bg-[#ff3c00]/[0.07]")}>
          <Layers className="h-4 w-4 text-[#ff3c00]" />
          <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">Universal forms</span><span className="block text-[11px] text-ink/45">{STANDARD_FORMS.length} standard · every client</span></span>
        </button>
        <div className="border-b border-hair p-2.5">
          <div className="flex h-8 items-center gap-2 border border-hair bg-paper px-2.5">
            <Search className="h-3.5 w-3.5 text-ink/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none" />
          </div>
          <label className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink/55"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-3.5 w-3.5 accent-[#ff3c00]" /> Show inactive clients</label>
        </div>
        <div className="max-h-[60vh] divide-y divide-hair overflow-y-auto">
          {clients.map((c) => {
            const n = countFor(c);
            return (
              <button key={c.id} type="button" onClick={() => setSel(c.id)} className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#ff3c00]/[0.04]", sel === c.id && "bg-[#ff3c00]/[0.07]")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-hair bg-white">{c.logo_url ? <img src={c.logo_url} alt="" className="h-full w-full object-contain p-0.5" /> : <span className="text-[11px] font-semibold text-[#ff3c00]">{(c.business || "?")[0]}</span>}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{c.business}</span>
                  <span className="block text-[10.5px] text-ink/45">{n.total} forms · {n.custom} custom{c.status === "Lead" ? " · lead" : ""}</span>
                </span>
              </button>
            );
          })}
          {!clients.length ? <p className="px-4 py-4 text-[12px] text-ink/50">{clientsQ.isLoading ? "Loading…" : "No clients match."}</p> : null}
        </div>
      </aside>
      <div className="min-w-0">
        {client ? <ClientForms key={client.id} client={client} customForms={custom} /> : <UniversalForms customForms={custom} templates={templates} setTemplates={setTemplates} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export default function FormsHub({ templates, setTemplates }) {
  const [tab, setTab] = useState("lead");
  const active = SUBTABS.find((t) => t.key === tab) || SUBTABS[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {SUBTABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-[12.5px] font-medium transition-colors", tab === t.key ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/65 hover:border-ink/40 hover:text-ink")}>
              <Icon className={cn("h-3.5 w-3.5", tab === t.key ? "text-[#ff3c00]" : "")} /> {t.label}
            </button>
          );
        })}
      </div>
      <p className="border-l-2 border-[#ff3c00] pl-3 text-[12.5px] text-ink/65">{active.what}</p>
      {tab === "lead" ? <LeadCapture /> : tab === "onboarding" ? <OnboardingIntake templates={templates} setTemplates={setTemplates} /> : <RequestFormsTab templates={templates} setTemplates={setTemplates} />}
    </div>
  );
}


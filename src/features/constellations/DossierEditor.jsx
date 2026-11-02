import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Sparkles } from "lucide-react";
import { Panel, Tag } from "@/features/clients/ui";
import { timeAgo } from "@/lib/useData";
import { queueCustom, useRefreshJobs } from "@/features/claude/jobs";

const input = "w-full rounded-lg border border-hair bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#ff3c00]";
const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, path, v) => {
  const copy = structuredClone(o || {});
  const keys = path.split(".");
  let cur = copy;
  keys.slice(0, -1).forEach((k) => { cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {}; cur = cur[k]; });
  cur[keys.at(-1)] = v;
  return copy;
};

function Label({ children, hint }) {
  return <p className="mb-1.5 text-[11.5px] font-medium text-ink/60">{children}{hint && <span className="ml-1.5 font-normal text-ink/35">{hint}</span>}</p>;
}
function Text({ d, setD, path, label, hint, area, placeholder }) {
  const v = get(d, path) || "";
  return (
    <label className="block">
      <Label hint={hint}>{label}</Label>
      {area ? <textarea rows={3} className={input} value={v} placeholder={placeholder} onChange={(e) => setD(set(d, path, e.target.value))} />
        : <input className={input} value={v} placeholder={placeholder} onChange={(e) => setD(set(d, path, e.target.value))} />}
    </label>
  );
}
function Chips({ d, setD, path, label, hint, placeholder = "Type and press Enter" }) {
  const list = get(d, path) || [];
  const [t, setT] = useState("");
  const add = () => { const v = t.trim(); if (!v) return; setD(set(d, path, [...list, v])); setT(""); };
  return (
    <div>
      <Label hint={hint}>{label}</Label>
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-hair bg-white p-2">
        {list.map((x, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-ink/[.05] px-2 py-1 text-[12.5px]">
            {x}<button onClick={() => setD(set(d, path, list.filter((_, j) => j !== i)))} className="text-ink/35 hover:text-[#ff3c00]">×</button>
          </span>
        ))}
        <input className="min-w-[160px] flex-1 bg-transparent px-1 text-[13px] outline-none" value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} onBlur={add} />
      </div>
    </div>
  );
}
function Rows({ d, setD, path, label, cols, hint, empty }) {
  const rows = get(d, path) || [];
  const upd = (i, k, v) => setD(set(d, path, rows.map((r, j) => (j === i ? { ...r, [k]: v } : r))));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label hint={hint}>{label}</Label>
        <button onClick={() => setD(set(d, path, [...rows, {}]))} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#ff3c00]"><Plus className="h-3.5 w-3.5" /> Add</button>
      </div>
      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-hair px-3 py-3 text-[12.5px] text-ink/40">{empty || "Nothing yet."}</p> : (
        <div className="overflow-x-auto rounded-lg border border-hair">
          <table className="w-full text-[12.5px]">
            <thead className="bg-ink/[.03] text-left text-[10.5px] uppercase tracking-wide text-ink/45">
              <tr>{cols.map((c) => <th key={c.k} className="px-2 py-1.5 font-medium" style={{ minWidth: c.w || 110 }}>{c.l}</th>)}<th className="w-8" /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-hair">
                  {cols.map((c) => (
                    <td key={c.k} className="px-1 py-1">
                      {c.opts ? (
                        <select className="w-full rounded border-0 bg-transparent px-1 py-1 outline-none" value={r[c.k] || ""} onChange={(e) => upd(i, c.k, e.target.value)}>
                          <option value="">—</option>{c.opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input className="w-full rounded border-0 bg-transparent px-1 py-1 outline-none focus:bg-ink/[.03]" type={c.num ? "number" : "text"} value={r[c.k] ?? ""} onChange={(e) => upd(i, c.k, c.num ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
                      )}
                    </td>
                  ))}
                  <td className="px-1"><button onClick={() => setD(set(d, path, rows.filter((_, j) => j !== i)))} className="p-1 text-ink/30 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const SECTIONS = [
  ["identity", "Identity"], ["audience", "Audience"], ["offer", "Offer"], ["brand", "Brand voice & look"],
  ["area", "Service area"], ["keywords", "Keywords"], ["market", "Market & ops"],
];

export default function DossierEditor({ client, con }) {
  const [d, setD] = useState(con.d);
  const [saving, setSaving] = useState(false);
  const [sec, setSec] = useState("identity");
  const refresh = useRefreshJobs();
  useEffect(() => { setD(con.d); }, [con.dossier?.id, con.dossier?.updated_date]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(d) !== JSON.stringify(con.d);

  const save = async () => {
    setSaving(true);
    const { id: _i, created_date: _c, updated_date: _u, created_by: _b, created_by_id: _bi, is_sample: _s, ...fields } = d;
    try { await con.save(fields); } finally { setSaving(false); }
  };
  const refreshKeywords = async () => {
    if (!window.confirm(`Have Claude research and refresh ${client.business}'s keywords and service-area cities now?`)) return;
    await queueCustom({ title: `Keyword refresh — ${client.business}`, kind: "research", client, instructions: keywordBrief(client) });
    refresh();
    window.alert("Queued. Claude will update the keyword list and log every change.");
  };

  const kwCount = (d.keywords || []).filter((k) => k.status !== "retired").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {SECTIONS.map(([k, l]) => (
          <button key={k} onClick={() => setSec(k)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] font-medium ${sec === k ? "bg-ink text-white" : "text-ink/60 hover:bg-ink/[.04]"}`}>
            {l}{k === "keywords" && <span className="ml-1.5 text-[11px] opacity-60">{kwCount}</span>}
          </button>
        ))}
        <div className="mt-3 hidden text-[11.5px] leading-relaxed text-ink/45 lg:block">
          Every field here feeds the health score, the website builds, blog and GBP posts. Claude fills these from audits and your project summaries — edit anything.
          {con.d.last_enriched_at && <p className="mt-2">Last enriched {timeAgo(con.d.last_enriched_at)}</p>}
        </div>
      </nav>

      <div className="min-w-0">
        <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center justify-between gap-3 bg-paper/90 px-1 py-2 backdrop-blur">
          <p className="text-[13px] text-ink/50">{dirty ? "Unsaved changes" : "All saved"}</p>
          <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff3c00] px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-40"><Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save dossier"}</button>
        </div>

        {sec === "identity" && (
          <Panel label="(Who they are)" bodyClass="p-4 grid gap-4 md:grid-cols-2">
            <Text d={d} setD={setD} path="tagline" label="Tagline" />
            <Text d={d} setD={setD} path="founded" label="Founded" hint="year" />
            <div className="md:col-span-2"><Text d={d} setD={setD} path="elevator_pitch" label="Elevator pitch" hint="who they help, with what, and the result" area /></div>
            <div className="md:col-span-2"><Text d={d} setD={setD} path="usp" label="Why choose them (USP)" area /></div>
            <div className="md:col-span-2"><Chips d={d} setD={setD} path="differentiators" label="Differentiators" /></div>
            <div className="md:col-span-2"><Text d={d} setD={setD} path="story" label="Founder / origin story" area /></div>
            <Text d={d} setD={setD} path="team_size" label="Team size" />
          </Panel>
        )}

        {sec === "audience" && (
          <Panel label="(Who they sell to)" bodyClass="p-4 grid gap-4">
            <Text d={d} setD={setD} path="audience.ideal_customer" label="Ideal customer" area />
            <Text d={d} setD={setD} path="audience.demographics" label="Demographics" />
            <Chips d={d} setD={setD} path="audience.pains" label="Pains" hint="what keeps them up at night" />
            <Chips d={d} setD={setD} path="audience.desires" label="Desires" />
            <Chips d={d} setD={setD} path="audience.objections" label="Objections" hint="why they don't buy" />
            <Chips d={d} setD={setD} path="audience.where_they_hang_out" label="Where they hang out" />
          </Panel>
        )}

        {sec === "offer" && (
          <Panel label="(The offer · Hormozi value equation)" bodyClass="p-4 grid gap-4">
            <Text d={d} setD={setD} path="dream_outcome" label="Dream outcome" hint="the result the customer actually wants, in their words" area />
            <Rows d={d} setD={setD} path="offers" label="Offers / money model" hint="attraction → core → upsell / downsell → continuity" empty="No offers on file yet."
              cols={[{ k: "name", l: "Name", w: 160 }, { k: "kind", l: "Type", opts: ["attraction", "core", "upsell", "downsell", "continuity"] }, { k: "price", l: "Price" }, { k: "promise", l: "Promise", w: 200 }, { k: "guarantee", l: "Guarantee", w: 160 }, { k: "bonuses", l: "Bonuses", w: 160 }]} />
            <Rows d={d} setD={setD} path="services" label="Services" cols={[{ k: "name", l: "Service", w: 180 }, { k: "priority", l: "Priority", opts: ["core", "growth", "minor"] }, { k: "page_url", l: "Page URL", w: 220 }, { k: "description", l: "Notes", w: 200 }]} />
          </Panel>
        )}

        {sec === "brand" && (
          <Panel label="(Voice & identity)" bodyClass="p-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Chips d={d} setD={setD} path="brand_voice.tone" label="Tone words" hint="e.g. confident, local, no-nonsense" /></div>
            <div className="md:col-span-2"><Text d={d} setD={setD} path="brand_voice.personality" label="Personality" area /></div>
            <Chips d={d} setD={setD} path="brand_voice.say" label="Always say" />
            <Chips d={d} setD={setD} path="brand_voice.never_say" label="Never say" />
            <div className="md:col-span-2"><Text d={d} setD={setD} path="brand_voice.sample" label="Sample paragraph in their voice" area /></div>
            <Chips d={d} setD={setD} path="brand_identity.colors" label="Brand colors" hint="hex" />
            <Text d={d} setD={setD} path="brand_identity.fonts" label="Fonts" />
            <Text d={d} setD={setD} path="brand_identity.style" label="Visual style" />
            <Text d={d} setD={setD} path="brand_identity.photo_style" label="Photo style" />
            <div className="md:col-span-2"><Text d={d} setD={setD} path="brand_identity.logo_url" label="Logo URL" /></div>
          </Panel>
        )}

        {sec === "area" && (
          <Panel label="(Where they work)" bodyClass="p-4 grid gap-4 md:grid-cols-3">
            <label className="block"><Label>Business model</Label>
              <select className={input} value={d.service_area?.model || ""} onChange={(e) => setD(set(d, "service_area.model", e.target.value))}>
                <option value="">—</option>{["storefront", "service_area", "hybrid", "national", "online"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <Text d={d} setD={setD} path="service_area.primary_city" label="Primary city" />
            <Text d={d} setD={setD} path="service_area.radius" label="Radius" hint="e.g. 30 mi" />
            <div className="md:col-span-3">
              <Rows d={d} setD={setD} path="service_area.cities" label="Cities we market to" empty="No cities yet."
                cols={[{ k: "city", l: "City", w: 150 }, { k: "state", l: "State", w: 60 }, { k: "priority", l: "Priority", opts: ["core", "growth", "later"] }, { k: "status", l: "Status", opts: ["not_started", "targeting", "page_live", "ranking"] }, { k: "page_url", l: "City page URL", w: 220 }, { k: "notes", l: "Notes", w: 160 }]} />
            </div>
          </Panel>
        )}

        {sec === "keywords" && (
          <Panel label="(Keywords · managed by Claude)" action={<button onClick={refreshKeywords} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#ff3c00]"><Sparkles className="h-3.5 w-3.5" /> Refresh now</button>} bodyClass="p-4 grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink/55">
              <Tag tone="ink">Auto-managed</Tag>
              Claude reviews these every month: adds what's worth chasing, retires what isn't, maps each one to a page, and logs why.
              {d.keywords_updated_at && <span>Last refresh {timeAgo(d.keywords_updated_at)}.</span>}
            </div>
            <Rows d={d} setD={setD} path="keywords" label="Target keywords" empty="Claude builds this list on the first refresh."
              cols={[{ k: "term", l: "Keyword", w: 220 }, { k: "city", l: "City", w: 110 }, { k: "intent", l: "Intent", opts: ["service", "emergency", "cost", "comparison", "informational", "brand"] }, { k: "priority", l: "Priority", opts: ["primary", "secondary", "long_tail"] }, { k: "status", l: "Status", opts: ["target", "in_progress", "ranking", "won", "retired"] }, { k: "rank", l: "Rank", num: true, w: 60 }, { k: "page_url", l: "Page", w: 200 }]} />
            {(d.keyword_log || []).length > 0 && (
              <div>
                <Label>Change log</Label>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-hair p-3 text-[12.5px]">
                  {[...d.keyword_log].reverse().map((l, i) => <p key={i}><span className="text-ink/40">{l.date}</span> · {l.change}{l.why && <span className="text-ink/45"> — {l.why}</span>}</p>)}
                </div>
              </div>
            )}
          </Panel>
        )}

        {sec === "market" && (
          <Panel label="(Market & operations)" bodyClass="p-4 grid gap-4">
            <Rows d={d} setD={setD} path="competitors" label="Competitors" cols={[{ k: "name", l: "Name", w: 160 }, { k: "url", l: "Website", w: 180 }, { k: "strength", l: "Strength", w: 180 }, { k: "weakness", l: "Weakness", w: 180 }]} />
            <Chips d={d} setD={setD} path="lead_sources" label="Lead sources" hint="where customers come from today" />
            <Chips d={d} setD={setD} path="tools" label="Software they use" />
            <Text d={d} setD={setD} path="notes" label="Other notes" area />
          </Panel>
        )}
      </div>
    </div>
  );
}

export function keywordBrief(client) {
  return [
    `# Keyword + service-area refresh — ${client.business}`,
    `Client id ${client.id}${client.domain ? ` · ${client.domain}` : ""} · industry: ${client.industry || "?"} · location: ${client.location || "?"}`,
    "",
    "Justin never manages keywords — you do. Update this client's ClientDossier (create it if missing):",
    "1. Read the dossier, CRMClient, latest IntakeAudit, open ClientGaps, and their live site (WebFetch) and Google Business Profile.",
    "2. service_area: make sure model, primary_city and cities[] are right (city, state, priority core|growth|later, status, page_url if a city page exists on their site).",
    "3. keywords[]: keep a focused list (about 15–40). For each core service × core city, plus emergency/cost/comparison intents and long-tails worth chasing. Set intent, priority, status, and page_url = the page on their site that should rank (blank if none exists yet — that becomes a page to build).",
    "4. Use real data only. Set rank only from Search Console or a real check, with rank_source. Never invent search volumes or ranks.",
    "5. Retire terms that aren't worth it (status 'retired', note why) instead of deleting.",
    "6. Append each change to keyword_log [{date, change, why}] and set keywords_updated_at = now.",
    "7. Also fill any empty dossier fields you can verify (services, tagline, USP, brand voice tone) and set last_enriched_at.",
    "Return a short summary of what changed.",
  ].join("\n");
}

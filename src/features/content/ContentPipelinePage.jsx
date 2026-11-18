// Client posts: the content pipeline log (docs/content-pipeline.md). Every project / testimonial a client sent from
// their Command System, what the automatic checks said, what was written, the live link, and one-click Unpublish,
// Republish, Edit and Retry. Posts go live with no review step; this page is the undo and the audit trail.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ExternalLink, X, KeyRound, Globe, Check, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { fmtDate, timeAgo } from "@/lib/useData";
import { Tag, SmallBtn, Panel, Empty } from "@/features/clients/ui";
import ManualKit from "@/features/content/ManualKit";

const TABS = [["queue", "In progress"], ["manual", "Build manually"], ["live", "Live"], ["problems", "Needs attention"], ["unpublished", "Unpublished"], ["tests", "Tests"], ["all", "All"]];
const TONE = { live: "green", queued: "flame", processing_images: "flame", writing: "flame", publishing: "flame", received: "flame", needs_info: "amber", rejected: "red", failed: "red", unpublished: "muted", test_passed: "ink", manual: "amber" };
const label = (st) => String(st || "").replace(/_/g, " ");

async function call(action, body = {}) {
  try {
    const res = await base44.functions.invoke("content-admin", { action, ...body });
    return res.data;
  } catch (e) {
    return e?.response?.data || { ok: false, error: e?.message || "Request failed" };
  }
}

// Two-step button instead of a confirm dialog: the first click arms it, the second does it.
function ConfirmBtn({ children, armed: armedLabel, onConfirm, disabled }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <SmallBtn active={armed} onClick={() => { if (disabled) return; if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      {armed ? armedLabel : children}
    </SmallBtn>
  );
}

// Per-site automatic posting switch. Off (or any failed publish) sends submissions to "Build manually".
function AutoPublishBtn({ site, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const flip = async () => {
    setBusy(true); setErr("");
    const r = await call("set_auto_publish", { site_app_id: site.app_id, auto_publish: !site.auto_publish });
    setBusy(false);
    if (!r?.ok) setErr(r?.error || "Could not save"); else onChanged();
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <SmallBtn active={site.auto_publish} onClick={busy ? undefined : flip} title="When off, every submission for this site goes to Build manually">
        {busy ? "Saving…" : site.auto_publish ? "Auto-publish on" : "Auto-publish off"}
      </SmallBtn>
      {err && <span className="text-[12px] text-red-700">{err}</span>}
    </span>
  );
}

function StatusPanel({ overview, onRefresh }) {
  if (!overview) return null;
  const ok = (v) => (v ? <Check className="inline h-3.5 w-3.5 text-green-700" /> : <AlertTriangle className="inline h-3.5 w-3.5 text-amber-600" />);
  return (
    <Panel label="Setup" title="Publishing keys and sites" action={<SmallBtn onClick={onRefresh}><RefreshCw className="mr-1 inline h-3 w-3" />Refresh</SmallBtn>}>
      <div className="grid gap-3 text-[13px] md:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-ink/55">Each client site has its own publish key: one Møthership secret per site (named below) and CONTENT_PUBLISH_KEY on that website, same value.</p>
          <p><KeyRound className="mr-1 inline h-3.5 w-3.5 text-ink/50" />COMMAND_SYSTEM_SYNC_KEY in Møthership: {ok(overview.sync_key_configured)} {overview.sync_key_configured ? "set" : "not set"}</p>
          <p className="text-ink/55">Counts: {Object.entries(overview.counts || {}).map(([k, v]) => `${label(k)} ${v}`).join(" · ") || "no submissions yet"}</p>
        </div>
        <div className="space-y-1.5">
          {(overview.sites || []).map((s) => (
            <p key={s.app_id}>
              <Globe className="mr-1 inline h-3.5 w-3.5 text-ink/50" />{s.name}: endpoint {s.reachable ? "reachable" : "unreachable"} · {s.key_secret} in Møthership {ok(s.key_configured)} {s.key_configured ? "set" : "not set"} · on the website {ok(s.configured)} {s.configured ? "set" : "not set"}
              {s.indexnow ? " · IndexNow on" : " · IndexNow not set up"}{s.enabled ? "" : " · switched off"}
              <span className="mt-1 flex flex-wrap items-center gap-2"><AutoPublishBtn site={s} onChanged={onRefresh} />{s.live_check_note && <span className="text-[12px] text-ink/50">{s.live_check_note}</span>}</span>
            </p>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function EditForm({ item, editable, fields: given, onDone }) {
  const fields = given?.length ? given : editable?.[item.kind] || [];
  const out = item.writer_output || {};
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((f) => [f, Array.isArray(out[f]) ? out[f].join(", ") : out[f] ?? ""])));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setBusy(true); setMsg("");
    const changed = {};
    for (const f of fields) {
      const before = Array.isArray(out[f]) ? out[f].join(", ") : String(out[f] ?? "");
      if (String(vals[f]) !== before) changed[f] = f === "services" ? String(vals[f]).split(",").map((x) => x.trim()).filter(Boolean) : vals[f];
    }
    if (!Object.keys(changed).length) { setBusy(false); setMsg("Nothing changed"); return; }
    const r = await call("edit", { id: item.id, fields: changed });
    setBusy(false);
    setMsg(r?.ok ? "Saved and updated on the website" : r?.error || "Could not save");
    if (r?.ok) onDone();
  };
  return (
    <div className="space-y-2 border border-hair bg-card p-3">
      <p className="mono-label text-[10px] text-ink/50">Edit (only changed fields are sent; the URL stays the same)</p>
      {fields.map((f) => (
        <label key={f} className="block text-[12px]">
          <span className="text-ink/60">{label(f)}</span>
          {f === "overview" || f === "summary" ? (
            <textarea value={vals[f]} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} rows={5} className="mt-1 w-full border border-hair bg-canvas p-2 text-[13px]" />
          ) : (
            <input value={vals[f]} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} className="mt-1 w-full border border-hair bg-canvas p-2 text-[13px]" />
          )}
        </label>
      ))}
      <div className="flex items-center gap-2">
        <SmallBtn onClick={save}>{busy ? "Saving…" : "Save and update"}</SmallBtn>
        {msg && <span className="text-[12px] text-ink/60">{msg}</span>}
      </div>
    </div>
  );
}

function Detail({ id, editable, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(false);
  const load = useCallback(async () => setData(await call("get", { id })), [id]);
  useEffect(() => { load(); }, [load]);
  const act = async (action) => {
    setBusy(action); setMsg("");
    const r = await call(action, { id });
    setBusy(""); setMsg(r?.ok ? (r.note || "Done") : r?.error || "Failed");
    await load(); onChanged();
  };
  const item = data?.item;
  const post = data?.post;
  const showKit = manual || item?.status === "manual";
  const markPosted = async (url) => {
    const r = await call("mark_posted", { id, url });
    if (r?.ok) { await load(); onChanged(); }
    return r;
  };
  return (
    <div role="dialog" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[5vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl border border-hair bg-canvas shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-4">
          <div className="min-w-0">
            {item && (
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="ink">{item.kind}</Tag>
                <Tag tone={TONE[item.status] || "muted"}>{label(item.status)}</Tag>
                {item.is_test && <Tag tone="amber">test</Tag>}
                <span className="mono-label text-[9px] text-ink/45">v{item.version || 1}</span>
              </div>
            )}
            <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">{item?.writer_output?.title || item?.writer_output?.name || item?.raw?.shoot_title || item?.raw?.customer_name || "Submission"}</h3>
            {item && <p className="text-[12px] text-ink/55"><Link to={`/clients/${item.client_id}`} className="hover:text-[#ff3c00]">{item.client_name}</Link> · {item.submitted_by} · received {fmtDate(item.received_at)}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {!item ? <p className="p-5 text-[13px] text-ink/55">Loading…</p> : (
          <div className="space-y-4 px-5 py-5 text-[13px]">
            {item.status_detail && <p className="border-l-2 border-[#ff6a00] pl-3">{item.status_detail}</p>}
            {item.published_url && <p><a href={item.published_url} target="_blank" rel="noreferrer" className="text-[#ff3c00] hover:underline">{item.published_url}<ExternalLink className="ml-1 inline h-3 w-3" /></a></p>}
            <div className="flex flex-wrap gap-2">
              {item.status === "live" && <ConfirmBtn armed="Click again to unpublish" onConfirm={() => act("unpublish")} disabled={!!busy}>Unpublish</ConfirmBtn>}
              {item.status === "unpublished" && <ConfirmBtn armed="Click again to republish" onConfirm={() => act("republish")} disabled={!!busy}>Republish</ConfirmBtn>}
              {item.writer_output && ["live", "unpublished", "needs_info", "failed"].includes(item.status) && <SmallBtn active={editing} onClick={() => setEditing(!editing)}>Edit</SmallBtn>}
              {["failed", "needs_info", "rejected", "manual"].includes(item.status) && <ConfirmBtn armed="Click again to retry" onConfirm={() => act("retry")} disabled={!!busy}>{item.status === "manual" ? "Retry automatic publish" : "Retry"}</ConfirmBtn>}
              {item.status !== "manual" && <SmallBtn active={showKit} onClick={() => setManual(!manual)}>Build page manually</SmallBtn>}
              {!item.is_test && ["queued", "processing_images", "writing", "publishing", "failed", "needs_info", "rejected", "unpublished"].includes(item.status) && <ConfirmBtn armed="Click again to move it" onConfirm={() => act("to_manual")} disabled={!!busy}>Move to manual queue</ConfirmBtn>}
              {busy && <span className="text-ink/55">Working…</span>}
              {msg && <span className="text-ink/70">{msg}</span>}
            </div>
            {item.posted_manually && <p className="text-[12px] text-ink/55">Built by hand and recorded with Mark as posted manually.</p>}
            {editing && <EditForm item={item} editable={editable} fields={data?.edit_fields} onDone={() => { setEditing(false); load(); onChanged(); }} />}
            {showKit && <ManualKit data={data} onMark={markPosted} />}
            <Panel label="Checks" title="Automatic safety checks">
              <ul className="space-y-1">
                {(item.gate_results || []).map((g, i) => <li key={i}>{g.ok ? "✓" : "✗"} {g.check}{g.note ? <span className="text-ink/55"> ({g.note})</span> : null}</li>)}
                {item.claim_check && <li>{item.claim_check.ok ? "✓" : "✗"} Fact check (every claim traced to the submission or client brain){item.claim_check.unsupported?.length ? <span className="text-ink/55"> ({item.claim_check.unsupported.join("; ")})</span> : null}</li>}
                {!item.gate_results?.length && <li className="text-ink/55">Not run yet</li>}
              </ul>
            </Panel>
            <Panel label="Photos" title={`${(item.images || []).length} prepared of ${(item.photos || []).length} sent`}>
              <p className="text-ink/60">{(item.images || []).filter((im) => im.compressed).length} compressed · {(item.images || []).filter((im) => im.exif_stripped).length} had location/camera metadata removed</p>
              {(item.image_notes || []).length > 0 && <ul className="mt-1 list-disc pl-5 text-ink/60">{item.image_notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            </Panel>
            {item.writer_output && (
              <Panel label="Written" title="What was sent to the website">
                <dl className="space-y-1">
                  {Object.entries(item.writer_output).filter(([k]) => !["images", "is_test", "unlisted", "catalog_from"].includes(k)).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[140px_1fr] gap-2"><dt className="text-ink/50">{label(k)}</dt><dd className="break-words">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</dd></div>
                  ))}
                </dl>
              </Panel>
            )}
            {post && (
              <Panel label="Live check" title={post.verify?.ok ? "Passed" : "Not confirmed yet"}>
                <p className="text-ink/60">Googlebot status {post.verify?.http_status} · title {String(post.verify?.title_ok)} · JSON-LD {String(post.verify?.jsonld_ok)} · sitemap {String(post.verify?.sitemap_ok)} · IndexNow {post.indexnow?.status}{post.indexnow?.note ? ` (${post.indexnow.note})` : ""}</p>
              </Panel>
            )}
            <Panel label="History" title="Every action">
              <ul className="space-y-1 text-[12px]">
                {[...(item.history || [])].reverse().map((h, i) => <li key={i}><span className="text-ink/45">{fmtDate(h.at)} {timeAgo(h.at)}</span> · {label(h.action)} · {h.by}{h.note ? ` · ${h.note}` : ""}</li>)}
              </ul>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ContentPipelinePage() {
  const [tab, setTab] = useState("queue");
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  const loadOverview = useCallback(async () => setOverview(await call("overview")), []);
  const loadList = useCallback(async () => { setItems(null); const r = await call("list", { tab }); setItems(r?.items || []); }, [tab]);
  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { loadList(); }, [loadList]);
  return (
    <div>
      <PageHeader breadcrumb="Clients / Client posts" rightText="Client submissions that go live on their websites" title="Client posts" />
      <div className="space-y-5 px-5 py-6 md:px-8">
        <p className="max-w-3xl text-[13px] text-ink/65">Projects and testimonials clients send from their Command System go live on their website straight away, after the automatic checks pass. Nothing is ever deleted: Unpublish takes a post down and keeps it on file. Every submission has a Build page manually view, and anything that can't post automatically (auto-publish off, a site that isn't set up, or a failed publish) lands in Build manually and emails you.</p>
        <StatusPanel overview={overview} onRefresh={loadOverview} />
        <div className="flex flex-wrap gap-2">
          {TABS.map(([k, l]) => <SmallBtn key={k} active={tab === k} onClick={() => setTab(k)}>{l}</SmallBtn>)}
          <SmallBtn onClick={() => { loadList(); loadOverview(); }}><RefreshCw className="inline h-3 w-3" /></SmallBtn>
        </div>
        {items === null ? <p className="text-[13px] text-ink/55">Loading…</p> : !items.length ? <Empty>Nothing here yet.</Empty> : (
          <div className="divide-y divide-hair border border-hair bg-card">
            {items.map((x) => (
              <button type="button" key={x.id} onClick={() => setOpen(x.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-ink/[0.03]">
                <Tag tone={TONE[x.status] || "muted"}>{label(x.status)}</Tag>
                {x.is_test && <Tag tone="amber">test</Tag>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{x.title || "(untitled)"}</span>
                  <span className="block truncate text-[12px] text-ink/55">{x.client_name} · {x.kind} · {x.status === "manual" ? x.manual_reason || "Build by hand" : x.status_detail || ""}{x.posted_manually ? " · posted manually" : ""}</span>
                </span>
                <span className="text-[12px] text-ink/45">{timeAgo(x.published_at || x.received_at)}</span>
                {x.published_url && x.status === "live" && <a href={x.published_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#ff3c00]" aria-label="Open live page"><ExternalLink className="h-3.5 w-3.5" /></a>}
              </button>
            ))}
          </div>
        )}
      </div>
      {open && <Detail id={open} editable={overview?.editable} onClose={() => setOpen(null)} onChanged={() => { loadList(); loadOverview(); }} />}
    </div>
  );
}

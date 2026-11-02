import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Download, Save, Trash2, Smartphone, ShieldCheck, AlertTriangle, Wand2, Zap, Lock, Check } from "lucide-react";
import QrCanvas from "./components/QrCanvas";
import WarpOverlay from "./components/WarpOverlay";
import ScanStats from "./components/ScanStats";
import ConfirmDialog from "./components/ConfirmDialog";
import { PacksPanel, ShapePanel, ColorPanel, LogoPanel, FramePanel, Label, Toggle } from "./components/DesignPanels";
import { DEFAULT_STYLE, applyPack, brandPack } from "./lib/presets";
import { scannability, autoFix } from "./lib/contrast";
import { CONTENT_TYPES, encodedValue, buildContent, httpUrl, isDynamic, scanOutcome } from "./lib/content";
import { downloadPNG, downloadSVG } from "./lib/draw";

const inputCls = "w-full border border-hair bg-paper px-3 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

const BLANK = {
  name: "", client_id: "", client_name: "", folder: "",
  content_type: "link", mode: "dynamic", destination: "", active: true,
  url: "", text: "", email_to: "", email_subject: "", email_body: "", phone: "", sms_body: "",
  wifi_ssid: "", wifi_password: "", wifi_encryption: "WPA", wifi_hidden: false, whatsapp_number: "", whatsapp_message: "",
  short_code: "", encoded_url: "", scans: 0,
};
const normalize = (c) => ({ ...BLANK, ...(c || {}), style: { ...DEFAULT_STYLE, ...((c && c.style) || {}) } });

const DESIGN_TABS = [["packs", "Packs"], ["shape", "Shape"], ["color", "Colour"], ["logo", "Logo"], ["frame", "Frame"]];

function ContentFields({ d, set }) {
  const f = (k) => ({ value: d[k] || "", onChange: (e) => set({ [k]: e.target.value }) });
  const t = d.content_type;
  if (t === "link") return <input className={inputCls} placeholder="https://example.com" {...f("url")} />;
  if (t === "text") return <textarea rows={4} className={inputCls} placeholder="Your text" maxLength={1200} {...f("text")} />;
  if (t === "email") return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="To (email address)" {...f("email_to")} />
      <input className={inputCls} placeholder="Subject" {...f("email_subject")} />
      <textarea rows={3} className={inputCls} placeholder="Message" {...f("email_body")} />
    </div>
  );
  if (t === "phone") return <input className={inputCls} placeholder="Phone number, e.g. +1 503 555 0100" {...f("phone")} />;
  if (t === "sms") return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Phone number" {...f("phone")} />
      <textarea rows={3} className={inputCls} placeholder="Pre-filled message" {...f("sms_body")} />
    </div>
  );
  if (t === "wifi") return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="Network name (SSID)" {...f("wifi_ssid")} />
      {d.wifi_encryption !== "nopass" && <input className={inputCls} placeholder="Password" {...f("wifi_password")} />}
      <div className="flex gap-2">
        {["WPA", "WEP", "nopass"].map((e) => (
          <button key={e} type="button" onClick={() => set({ wifi_encryption: e })} className={`h-8 flex-1 border text-[12px] ${d.wifi_encryption === e ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff3c00]" : "border-hair text-ink/60"}`}>{e === "nopass" ? "No password" : e}</button>
        ))}
      </div>
      <Toggle label="Hidden network" checked={d.wifi_hidden} onChange={(v) => set({ wifi_hidden: v })} />
    </div>
  );
  if (t === "whatsapp") return (
    <div className="space-y-2">
      <input className={inputCls} placeholder="WhatsApp number with country code, e.g. 15035550100" {...f("whatsapp_number")} />
      <textarea rows={3} className={inputCls} placeholder="Pre-filled message" {...f("whatsapp_message")} />
    </div>
  );
  return null;
}

function Step({ n, children }) {
  return (
    <h3 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.02em]">
      <span className="flex h-5 w-5 items-center justify-center rounded-full flame-bg text-[10.5px] text-white">{n}</span>
      {children}
    </h3>
  );
}

/**
 * QR code editor shared by Møthership (adminStore) and the client portal (portalStore).
 * Live preview redraws on every change; saving a new code opens the wormhole.
 */
export default function QrEditor({ store, id, start = {}, clients = [], onExit, onCreated, fullHeight = false }) {
  const isAdmin = store.kind === "admin";
  const [d, setD] = useState(null);
  const [brand, setBrand] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [tab, setTab] = useState("packs");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [warp, setWarp] = useState(false);
  const [scanTest, setScanTest] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dl, setDl] = useState("");
  const [copied, setCopied] = useState(false);

  const loadTemplates = () => store.listAll().then((r) => setTemplates(r.templates || [])).catch(() => setTemplates([]));

  useEffect(() => {
    let alive = true;
    (async () => {
      loadTemplates();
      if (id) {
        const c = await store.getCode(id);
        if (!alive) return;
        setD(normalize(c));
        setBrand(await store.brand(c?.client_id).catch(() => null));
      } else {
        const b = await store.brand(start.clientId).catch(() => null);
        if (!alive) return;
        setBrand(b);
        const client = clients.find((c) => c.id === start.clientId);
        setD(normalize({
          client_id: start.clientId || "", client_name: client?.business || b?.company || "", folder: start.folder || "",
          destination: (b?.website && httpUrl(b.website)) || "",
          style: applyPack({}, brandPack(b)?.style || {}),
        }));
      }
    })().catch((e) => setErr(e?.response?.data?.error || e?.message || "Couldn't load this code."));
    return () => {
      alive = false;
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(() => (d ? encodedValue(d) : ""), [d]);
  const scan = useMemo(() => scannability(d?.style), [d?.style]);
  if (!d) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        {err ? <p className="text-[13px] text-red-700">{err}</p> : <div className="h-8 w-8 animate-spin rounded-full border-4 border-ink/10 border-t-[#ff3c00]" />}
      </div>
    );
  }

  const set = (patch) => { setD((x) => ({ ...x, ...patch })); setNote(""); };
  const setStyle = (patch) => setD((x) => ({ ...x, style: { ...x.style, ...patch } }));
  const dynamic = isDynamic(d);
  const destOk = !!httpUrl(d.destination);
  const hasContent = dynamic ? destOk : !!buildContent(d);
  const minted = dynamic && !!d.short_code;
  const blockReason = !hasContent ? (dynamic ? "Add a destination link" : "Add the content first")
    : dynamic && !minted ? "Save to mint your short link first"
    : scan.level === "error" ? "Fix the contrast warnings first"
    : "";

  const changeClient = async (clientId) => {
    const c = clients.find((x) => x.id === clientId);
    set({ client_id: clientId, client_name: c?.business || "" });
    setBrand(await store.brand(clientId).catch(() => null));
  };

  const save = async () => {
    setSaving(true);
    setErr("");
    setNote("");
    try {
      const name = d.name.trim() || (dynamic ? (httpUrl(d.destination) ? new URL(httpUrl(d.destination)).hostname.replace(/^www\./, "") : "") : "") || "Untitled QR code";
      const r = await store.saveCode(id, { ...d, name });
      const fresh = !id || (dynamic && !d.short_code && r?.short_code);
      setD(normalize(r));
      if (fresh) {
        setWarp(true);
        setTimeout(() => setWarp(false), 1600);
      }
      setNote(fresh ? "Generated. Your code is live." : "Saved.");
      if (!id) onCreated?.(r);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const download = async (kind) => {
    setDl(kind);
    setErr("");
    try {
      if (kind === "png") await downloadPNG(value, d.style, d.name || "qr-code");
      else await downloadSVG(value, d.style, d.name || "qr-code");
    } catch (e) {
      setErr(e.message || "Download failed.");
    } finally {
      setDl("");
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(d.encoded_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const tplScopes = isAdmin
    ? [...(d.client_id ? [{ value: "client", label: `For ${d.client_name || "this client"}` }] : []), { value: "global", label: "For every client" }]
    : [{ value: "client", label: "Mine" }];
  const saveTemplate = async ({ name, scope }) => {
    const payload = { name, style: d.style, scope };
    if (isAdmin) Object.assign(payload, scope === "client" ? { client_id: d.client_id, client_name: d.client_name } : { client_id: "", client_name: "" });
    await store.saveTemplate(null, payload);
    await loadTemplates();
  };
  const canDeleteTpl = (t) => isAdmin || t.scope === "client";
  const visibleTemplates = isAdmin ? templates.filter((t) => t.scope === "global" || !d.client_id || t.client_id === d.client_id) : templates;

  return (
    <div className={`${fullHeight ? "h-full overflow-y-auto" : ""} bg-canvas`}>
      <header className="sticky top-0 z-30 border-b border-hair bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 md:px-8">
          <button type="button" onClick={onExit} className="flex items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink"><ArrowLeft className="h-4 w-4" /> QR codes</button>
          <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Name this code (e.g. Storefront window)" maxLength={120} className="min-w-0 flex-1 border-b border-transparent bg-transparent px-1 py-1 text-[16px] font-semibold tracking-[-0.02em] outline-none placeholder:text-ink/35 focus:border-[#ff3c00]" />
          {id && (
            <button type="button" onClick={() => setConfirmDel(true)} className="p-2 text-ink/45 hover:text-red-700" title="Delete code"><Trash2 className="h-4 w-4" /></button>
          )}
          <button type="button" onClick={save} disabled={saving} className="flex h-10 items-center gap-2 flame-bg px-5 text-[13px] font-medium text-white disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : id ? "Save" : "Generate code"}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-6 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
        <div className="space-y-6">
          <section className="space-y-4 border border-hair bg-card p-5">
            <Step n={1}>Where it goes</Step>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => set({ mode: "dynamic", content_type: "link" })} className={`border p-3 text-left transition-colors ${dynamic ? "border-[#ff3c00] bg-[#fff1ea]" : "border-hair bg-paper hover:border-ink/40"}`}>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Zap className="h-3.5 w-3.5 text-[#ff3c00]" /> Dynamic</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink/55">Change the link anytime and count every scan.</p>
              </button>
              <button type="button" onClick={() => set({ mode: "static" })} className={`border p-3 text-left transition-colors ${!dynamic ? "border-[#ff3c00] bg-[#fff1ea]" : "border-hair bg-paper hover:border-ink/40"}`}>
                <p className="flex items-center gap-1.5 text-[13.5px] font-semibold"><Lock className="h-3.5 w-3.5" /> Static</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink/55">Data lives in the image. Never expires, can&apos;t be edited or tracked.</p>
              </button>
            </div>

            {dynamic ? (
              <div className="space-y-3">
                <div>
                  <Label>Destination link</Label>
                  <input className={inputCls} value={d.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="https://your-site.com/menu" />
                  {d.destination && !destOk && <p className="mt-1 text-[11.5px] text-red-700">Use a normal web link (http or https).</p>}
                </div>
                {minted ? (
                  <div className="border border-hair bg-paper p-3">
                    <p className="mono-label text-[9px] text-ink/50">Your permanent short link</p>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{d.encoded_url}</code>
                      <button type="button" onClick={copyLink} className="flex items-center gap-1 text-[12px] text-ink/60 hover:text-[#ff3c00]">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-ink/55">This is what&apos;s printed. Change the destination whenever you like and every printed copy follows.</p>
                  </div>
                ) : (
                  <p className="text-[11.5px] text-ink/55">Generating mints a permanent short link. The preview shows a placeholder until then.</p>
                )}
                {id && minted && (
                  <Toggle label={d.active === false ? "Paused: scans see a 'paused' page" : "Live: scans go to the destination"} checked={d.active !== false} onChange={(v) => set({ active: v })} />
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {d.short_code && <p className="flex items-start gap-1.5 border border-amber-300 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Switching to static changes the image. Printed copies of the dynamic version keep working as long as this code isn&apos;t deleted.</p>}
                <div className="flex flex-wrap gap-1.5">
                  {CONTENT_TYPES.map((t) => (
                    <button key={t.id} type="button" onClick={() => set({ content_type: t.id })} className={`h-8 border px-3 text-[12.5px] ${d.content_type === t.id ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/65 hover:border-ink/40"}`}>{t.label}</button>
                  ))}
                </div>
                <ContentFields d={d} set={set} />
              </div>
            )}

            <div className="grid gap-3 border-t border-hair pt-4 sm:grid-cols-2">
              {isAdmin && (
                <div>
                  <Label>Client</Label>
                  <select className={inputCls} value={d.client_id || ""} onChange={(e) => changeClient(e.target.value)}>
                    <option value="">Interstellar (internal)</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
                  </select>
                </div>
              )}
              <div className={isAdmin ? "" : "sm:col-span-2"}>
                <Label>Folder</Label>
                <input className={inputCls} value={d.folder} onChange={(e) => set({ folder: e.target.value })} placeholder="e.g. Storefront, Flyers, Events" maxLength={80} />
              </div>
            </div>
          </section>

          <section className="space-y-4 border border-hair bg-card p-5">
            <Step n={2}>Make it look like you</Step>
            <div className="no-scrollbar flex gap-5 overflow-x-auto border-b border-hair">
              {DESIGN_TABS.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-[13px] transition-colors ${tab === k ? "border-[#ff3c00] font-medium text-ink" : "border-transparent text-ink/50 hover:text-ink/75"}`}>{l}</button>
              ))}
            </div>
            {tab === "packs" && (
              <PacksPanel
                style={d.style}
                onApply={(s) => setD((x) => ({ ...x, style: applyPack(x.style, s) }))}
                brand={brand}
                templates={visibleTemplates}
                canDelete={canDeleteTpl}
                onDeleteTemplate={async (t) => { await store.deleteTemplate(t.id); loadTemplates(); }}
                onSaveTemplate={saveTemplate}
                templateScopes={tplScopes}
              />
            )}
            {tab === "shape" && <ShapePanel style={d.style} set={setStyle} />}
            {tab === "color" && <ColorPanel style={d.style} set={setStyle} />}
            {tab === "logo" && <LogoPanel style={d.style} set={setStyle} brand={brand} />}
            {tab === "frame" && <FramePanel style={d.style} set={setStyle} />}
          </section>
        </div>

        <div className="lg:sticky lg:top-[76px] lg:self-start">
          <section className="space-y-4 border border-hair bg-card p-5">
            <Step n={3}>Download &amp; launch</Step>
            <div
              className="relative overflow-hidden p-6 sm:p-8"
              style={{ background: "radial-gradient(1px 1px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 72% 12%, #fff 50%, transparent 51%), radial-gradient(1.5px 1.5px at 88% 64%, #ffaa00 50%, transparent 51%), radial-gradient(1px 1px at 28% 82%, #fff 50%, transparent 51%), radial-gradient(1px 1px at 52% 46%, rgba(255,255,255,.7) 50%, transparent 51%), radial-gradient(1.5px 1.5px at 8% 60%, #ff6a00 50%, transparent 51%), radial-gradient(ellipse at 50% 120%, rgba(255,60,0,.35), transparent 60%), #0d0d14" }}
            >
              <div className={`mx-auto max-w-[360px] bg-white p-3 shadow-[0_20px_60px_-20px_rgba(255,106,0,0.55)] transition-transform duration-300 ${warp ? "scale-95" : "scale-100"}`}>
                <QrCanvas value={value} style={d.style} pixelWidth={720} />
              </div>
              <WarpOverlay active={warp} label={dynamic ? "Wormhole open: short link minted" : "Wormhole open"} />
            </div>

            <div className={`border px-3 py-2.5 ${scan.level === "ok" ? "border-green-200 bg-green-50" : scan.level === "warn" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <span className={`flex items-center gap-1 font-semibold ${scan.level === "ok" ? "text-green-800" : scan.level === "warn" ? "text-amber-900" : "text-red-800"}`}>
                  {scan.level === "ok" ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {scan.level === "ok" ? "Scannable" : scan.level === "warn" ? "Scannable, with care" : "May not scan"}
                </span>
                <span className="font-mono text-[11px] text-ink/60">Contrast {scan.ratio.toFixed(1)}:1</span>
                <span className="font-mono text-[11px] text-ink/60">ECC {scan.ecc}</span>
                <span className="font-mono text-[11px] text-ink/60">Quiet zone {scan.quiet}</span>
                {scan.level !== "ok" && (
                  <button type="button" onClick={() => setD((x) => ({ ...x, style: autoFix(x.style) }))} className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[#ff3c00] hover:underline"><Wand2 className="h-3.5 w-3.5" /> Auto-fix</button>
                )}
              </div>
              {scan.issues.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {scan.issues.map((i, k) => <li key={k} className="text-[11.5px] text-ink/70">· {i.text}</li>)}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!!blockReason || !!dl} onClick={() => download("png")} className="flex h-11 items-center justify-center gap-2 bg-ink text-[13px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40"><Download className="h-4 w-4" /> {dl === "png" ? "Exporting…" : "PNG"}</button>
              <button type="button" disabled={!!blockReason || !!dl} onClick={() => download("svg")} className="flex h-11 items-center justify-center gap-2 border border-ink text-[13px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-40"><Download className="h-4 w-4" /> {dl === "svg" ? "Exporting…" : "SVG"}</button>
            </div>
            {blockReason && <p className="-mt-2 text-center text-[11.5px] text-ink/50">{blockReason}.</p>}
            {(err || note) && <p className={`text-[12.5px] ${err ? "text-red-700" : "text-green-800"}`}>{err || note}</p>}

            <div className="border border-hair">
              <button type="button" onClick={() => setScanTest((v) => !v)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium hover:bg-paper">
                <Smartphone className="h-4 w-4 text-[#ff3c00]" /> Scan test
                <span className="ml-auto text-[11.5px] font-normal text-ink/50">{scanTest ? "Hide" : "Try it with your phone"}</span>
              </button>
              {scanTest && (
                <div className="space-y-3 border-t border-hair px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-14 w-10 shrink-0 items-center justify-center rounded-md border-2 border-ink">
                      <span className="absolute inset-x-1.5 top-1/2 h-[2px] animate-pulse bg-[#ff3c00]" />
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-ink/70">
                      Open your phone&apos;s camera (no app needed) and hold it 15–30 cm from the code on screen. Tap the link that pops up.
                      <br />
                      <span className="text-ink">{scanOutcome(d)}</span>
                    </p>
                  </div>
                  {minted && id ? (
                    <div>
                      <p className="mono-label mb-2 text-[9px] text-ink/50">Live counter: watch it tick</p>
                      <ScanStats store={store} codeId={id} live compact />
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-ink/50">{dynamic ? "Generate the code to watch scans count live." : "Static codes can't count scans. Switch to dynamic to track them."}</p>
                  )}
                </div>
              )}
            </div>

            {minted && id && !scanTest && (
              <div className="border-t border-hair pt-4">
                <p className="mono-label mb-3 text-[9.5px] text-ink/50">Scans</p>
                <ScanStats store={store} codeId={id} />
              </div>
            )}
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete this QR code?"
        body={minted ? "This is a dynamic code. Every printed copy will stop working and show a 'not found' page. To stop it temporarily, pause it instead." : "This removes it from your library. Printed static codes keep working because the data is in the image."}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => {
          await store.deleteCode(id);
          onExit();
        }}
      />
    </div>
  );
}

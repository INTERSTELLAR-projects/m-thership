import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Copy, Download, Code, Check, Loader2, Sparkles, Star, LayoutTemplate, Paintbrush } from "lucide-react";
import SignatureForm from "@/features/signatures/editor/SignatureForm";
import SignaturePreview from "@/features/signatures/editor/SignaturePreview";
import InstallInstructionsModal from "@/features/signatures/InstallInstructionsModal";
import { generateSignatureHTML, collectAssetSpecs, plainTextSignature, normalize, TEMPLATES } from "@/features/signatures/lib/signatureTemplates";
import { useSignatureAssets } from "@/features/signatures/lib/assetStore";
import { startFrom, scrubForGlobal } from "@/features/signatures/lib/signatureStore";
import { copyRichHtml, downloadHtmlFile } from "@/features/signatures/lib/clipboard";

const GRADIENT_BTN = "text-white font-semibold rounded-none px-4 py-2.5 transition shadow-sm hover:shadow-md disabled:opacity-60";
const gradientStyle = { background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" };
const GMAIL_LIMIT = 10000;

/**
 * Shared editor for admin and client portal.
 * store: adminStore | portalStore(call)
 * mode: "signature" | "template"
 * id: record id (null = new)
 * start: { templateId, clientId, folder } for new records
 * clients: admin client list (for the client-folder picker)
 * folders: existing project names (suggestions)
 */
export default function SignatureEditor({ store, mode = "signature", id, start = {}, clients = [], folders = [], onExit, onCreated, height }) {
  const isTemplate = mode === "template";
  const portal = store.kind === "portal";
  const init = useMemo(() => normalize({}, {}), []);
  const [rec, setRec] = useState(null);
  const [fields, setFields] = useState(init.f);
  const [theme, setTheme] = useState(init.t);
  const [templateId, setTemplateId] = useState("t5_rail");
  const [name, setName] = useState(isTemplate ? "New template" : "New signature");
  const [folder, setFolder] = useState(start.folder || "");
  const [clientId, setClientId] = useState(start.clientId || "");
  const [sourceTpl, setSourceTpl] = useState(null);
  const [isDefault, setIsDefault] = useState(false);
  const [scope, setScope] = useState(portal ? "client" : start.clientId ? "client" : "global");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [mobileTab, setMobileTab] = useState("edit");
  const [copied, setCopied] = useState(false);
  const [copyNote, setCopyNote] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [copying, setCopying] = useState(false);
  const [tplDialog, setTplDialog] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef(null);
  const recRef = useRef(null);

  // ---- load existing / start new from the default (or chosen) template ----
  useEffect(() => {
    let cancelled = false;
    // Just-created record whose id was pushed into the URL: nothing to reload.
    if (id && recRef.current?.id === id) return undefined;
    (async () => {
      try {
        if (id) {
          const r = isTemplate ? await store.getTemplate(id) : await store.getSignature(id);
          if (cancelled || !r) return;
          const { f, t } = normalize(r.fields || {}, r.theme || {});
          recRef.current = r;
          setRec(r);
          setName(r.name || name);
          setTemplateId(r.template_id || "t5_rail");
          setFields(f);
          setTheme(t);
          setFolder(r.folder || "");
          setClientId(r.client_id || "");
          setIsDefault(!!r.is_default);
          if (r.scope) setScope(r.scope);
        } else {
          const tpl = start.templateId ? await store.getTemplate(start.templateId) : await store.defaultTemplate(start.clientId || null);
          const brand = portal ? await store.brand() : start.clientId ? await store.brand(start.clientId) : null;
          if (brand) brand.applyColors = tpl?.scope !== "client";
          const s = startFrom(tpl, isTemplate ? null : brand);
          if (cancelled) return;
          if (isTemplate && tpl) s.fields = { ...normalize(tpl.fields || {}, tpl.theme || {}).f };
          setFields(s.fields);
          setTheme(s.theme);
          setTemplateId(s.template_id);
          setSourceTpl(tpl?.id || null);
        }
      } catch (e) {
        console.error(e);
      }
      if (!cancelled) {
        setLoading(false);
        setTimeout(() => (dirtyRef.current = false), 0);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode]);

  // ---- animated assets ----
  const specMap = useMemo(() => collectAssetSpecs({ fields, theme, template_id: templateId }), [fields, theme, templateId]);
  const onAssetSaved = useCallback((key, v) => setFields((prev) => ({ ...prev, assets: { ...(prev.assets || {}), [key]: v } })), []);
  const assets = useSignatureAssets(specMap, fields.assets, onAssetSaved);
  const previewHtml = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: false });
  const finalHtml = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: true });

  useEffect(() => {
    dirtyRef.current = true;
  }, [fields, theme, templateId, name, folder, clientId]);

  const clientName = clients.find((c) => c.id === clientId)?.business || rec?.client_name || "";

  const payload = () => {
    const keep = Object.fromEntries(Object.entries(fields.assets || {}).filter(([k]) => specMap[k]));
    const base = { name, template_id: templateId, fields: { ...fields, assets: keep }, theme, folder };
    if (isTemplate) {
      return {
        ...base,
        preview_html: finalHtml,
        ...(portal ? {} : { scope, client_id: scope === "client" ? clientId : "", client_name: scope === "client" ? clientName : "" }),
      };
    }
    return {
      ...base,
      generated_html: finalHtml,
      ...(sourceTpl ? { source_template_id: sourceTpl } : {}),
      ...(portal ? {} : { client_id: clientId || "", client_name: clientId ? clientName : "" }),
    };
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const cur = recRef.current;
      const saved = isTemplate ? await store.saveTemplate(cur?.id, payload()) : await store.saveSignature(cur?.id, payload());
      if (saved) {
        const created = !cur;
        recRef.current = saved;
        setRec(saved);
        if (created) onCreated?.(saved);
      }
      dirtyRef.current = false;
      setSavedAt(new Date());
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => dirtyRef.current && doSave(), 2500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, theme, templateId, name, folder, clientId, scope, loading]);

  const handleCopy = async () => {
    setCopying(true);
    setCopyNote("");
    let html = finalHtml;
    if (assets.pending > 0) {
      await assets.ensureAll();
      html = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: true });
    }
    const ok = await copyRichHtml(html, plainTextSignature(fields));
    setCopying(false);
    if (ok) {
      setCopied(true);
      setShowInstall(true);
      setTimeout(() => setCopied(false), 2000);
    } else setCopyNote("Animations are ready. Click Copy again.");
  };

  const applyBrand = async () => {
    const brand = await store.brand(clientId || undefined);
    if (!brand) return;
    const s = startFrom({ fields: { ...fields, company_name: "", logo_url: "", website: "", slogan: "" }, theme, template_id: templateId }, { ...brand, applyColors: true });
    setFields((prev) => ({ ...prev, company_name: s.fields.company_name, logo_url: s.fields.logo_url, website: s.fields.website, website_show: !!s.fields.website, slogan: s.fields.slogan }));
    setTheme((prev) => ({ ...prev, accent_color: s.theme.accent_color, accent_color_2: s.theme.accent_color_2 }));
  };

  const toggleDefault = async () => {
    if (!rec) await doSave();
    const r = recRef.current;
    if (!r) return;
    if (isDefault) await store.saveTemplate(r.id, { is_default: false });
    else await store.setDefault({ ...r, scope: portal ? "client" : scope, client_id: portal ? r.client_id : clientId });
    setIsDefault(!isDefault);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: height || "calc(100vh - 3rem)" }}>
        <Loader2 className="w-6 h-6 animate-spin text-[#ff3c00]" />
      </div>
    );
  }

  const chars = finalHtml.length;

  return (
    <div className="flex flex-col bg-background" style={{ height: height || "calc(100vh - 3rem)" }}>
      <div className="flex flex-wrap items-center gap-2 px-4 min-h-14 py-2 border-b border-border shrink-0">
        <button onClick={onExit} className="text-muted-foreground hover:text-foreground transition" title="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {isTemplate && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#ff3c00] border border-[#ff3c00]/40 px-1.5 py-0.5">Template</span>
        )}
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 w-56 font-medium" aria-label="Name" />
        <Input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          list="sig-folders"
          placeholder="Project / folder"
          className="h-9 w-40 text-sm"
          title="Organize into a project"
        />
        <datalist id="sig-folders">
          {folders.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        {!portal && (
          <>
            {isTemplate && (
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="h-9 rounded-sm border border-border bg-background px-2 text-sm"
                title="Who can use this template"
              >
                <option value="global">All clients</option>
                <option value="client">One client</option>
              </select>
            )}
            {(!isTemplate || scope === "client") && (
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 rounded-sm border border-border bg-background px-2 text-sm max-w-[190px]"
                title="Client folder: it shows in this client's portal"
              >
                <option value="">{isTemplate ? "Choose client…" : "Interstellar (internal)"}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.business}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        {(portal || clientId) && !isTemplate && (
          <Button variant="ghost" size="sm" onClick={applyBrand} title="Use the client's company name, logo, website, slogan and brand colors">
            <Paintbrush className="w-4 h-4 mr-1" /> Apply brand
          </Button>
        )}
        <div className="text-xs text-muted-foreground hidden lg:flex items-center gap-1.5">
          {assets.pending > 0 ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#ff6a00]" /> Rendering… {assets.pending}
            </>
          ) : saving ? (
            "Saving…"
          ) : savedAt ? (
            "Saved"
          ) : (
            "Auto-save on"
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {copyNote && <span className="text-xs text-[#ff3c00]">{copyNote}</span>}
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground transition px-1">
            Advanced
          </button>
          {isTemplate ? (
            <Button variant="outline" size="sm" onClick={toggleDefault} title="New signatures start from the default template">
              <Star className={`w-4 h-4 mr-1 ${isDefault ? "fill-[#ff6a00] text-[#ff6a00]" : ""}`} />
              {isDefault ? "Default" : "Make default"}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setTplDialog(true)}>
              <LayoutTemplate className="w-4 h-4 mr-1" /> Save as template
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={doSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Save
          </Button>
          {!isTemplate && (
            <button onClick={handleCopy} disabled={copying} className={GRADIENT_BTN + " text-sm inline-flex items-center"} style={gradientStyle}>
              {copying ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
              {copying ? "Preparing…" : copied ? "Copied!" : "Copy Signature"}
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-border bg-[#fff1ea]/50 text-sm">
          <span className="text-muted-foreground">Advanced:</span>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(finalHtml)} disabled={assets.pending > 0}>
            <Code className="w-3.5 h-3.5 mr-1" /> Copy HTML source
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadHtmlFile(finalHtml, `${name || "signature"}.html`)} disabled={assets.pending > 0}>
            <Download className="w-3.5 h-3.5 mr-1" /> Download .html
          </Button>
          <span className={`text-xs ${chars > GMAIL_LIMIT ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
            {chars.toLocaleString()} / {GMAIL_LIMIT.toLocaleString()} characters (Gmail limit)
          </span>
        </div>
      )}

      <div className="sm:hidden flex border-b border-border">
        {["edit", "preview"].map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2 text-sm font-medium capitalize ${mobileTab === t ? "text-[#ff3c00] border-b-2 border-[#ff3c00]" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full sm:w-[420px] sm:shrink-0 overflow-y-auto border-r border-border ${mobileTab === "edit" ? "block" : "hidden"} sm:block`}>
          <div className="px-5 pt-5">
            <label className="block mb-1 font-medium text-xs uppercase tracking-wider text-muted-foreground">Layout</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left rounded-none border p-3 transition ${templateId === t.id ? "border-[#ff3c00] bg-[#fff1ea]" : "border-border hover:bg-muted"}`}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
          <SignatureForm
            fields={fields}
            theme={theme}
            onFields={(next) => setFields((prev) => ({ ...next, assets: { ...(next.assets || {}), ...(prev.assets || {}) } }))}
            onTheme={setTheme}
          />
        </div>
        <div className={`flex-1 min-w-0 ${mobileTab === "preview" ? "block" : "hidden"} sm:block`}>
          <SignaturePreview html={previewHtml} templateId={TEMPLATES.find((t) => t.id === templateId)?.name || templateId} />
        </div>
      </div>

      {!isTemplate && <InstallInstructionsModal open={showInstall} onOpenChange={setShowInstall} />}
      {!isTemplate && (
        <SaveTemplateDialog
          open={tplDialog}
          onOpenChange={setTplDialog}
          portal={portal}
          clientId={clientId}
          clientName={clientName}
          folders={folders}
          defaultName={`${name} template`}
          onSave={async ({ tName, tFolder, tScope, makeDefault }) => {
            const global = !portal && tScope === "global";
            const keep = Object.fromEntries(Object.entries(fields.assets || {}).filter(([k]) => specMap[k]));
            const saved = await store.saveTemplate(null, {
              name: tName,
              folder: tFolder,
              template_id: templateId,
              theme,
              fields: global ? scrubForGlobal(fields) : { ...fields, assets: keep },
              preview_html: finalHtml,
              ...(portal ? {} : { scope: global ? "global" : "client", client_id: global ? "" : clientId, client_name: global ? "" : clientName }),
            });
            if (makeDefault && saved) await store.setDefault({ ...saved, scope: global ? "global" : "client", client_id: global ? "" : clientId || saved.client_id });
          }}
        />
      )}
    </div>
  );
}

function SaveTemplateDialog({ open, onOpenChange, portal, clientId, clientName, folders, defaultName, onSave }) {
  const [tName, setTName] = useState(defaultName);
  const [tFolder, setTFolder] = useState("");
  const [tScope, setTScope] = useState(clientId ? "client" : "global");
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (open) {
      setTName(defaultName);
      setTScope(clientId ? "client" : "global");
      setDone(false);
    }
  }, [open, defaultName, clientId]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-muted-foreground">Saved. It&apos;s in your Templates tab, ready to start new signatures from.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Template name</label>
              <Input value={tName} onChange={(e) => setTName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Project / folder</label>
              <Input value={tFolder} onChange={(e) => setTFolder(e.target.value)} list="sig-folders" className="mt-1" placeholder="Optional" />
            </div>
            {!portal && (
              <div>
                <label className="text-xs text-muted-foreground">Available to</label>
                <select value={tScope} onChange={(e) => setTScope(e.target.value)} className="mt-1 w-full h-9 rounded-sm border border-border bg-background px-2 text-sm">
                  <option value="global">All clients (Interstellar template)</option>
                  {clientId && <option value="client">Only {clientName || "this client"}</option>}
                </select>
                {tScope === "global" && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    The design is kept. The person, company, logo and links are cleared, so each client fills in their own.
                  </p>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
              Make this the default for new signatures
            </label>
          </div>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <Button
              disabled={busy || !tName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave({ tName: tName.trim(), tFolder: tFolder.trim(), tScope, makeDefault });
                  setDone(true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null} Save template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

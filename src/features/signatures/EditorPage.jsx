import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Download, Code, Check, Loader2, Sparkles } from "lucide-react";
import SignatureForm from "@/features/signatures/editor/SignatureForm";
import SignaturePreview from "@/features/signatures/editor/SignaturePreview";
import InstallInstructionsModal from "@/features/signatures/InstallInstructionsModal";
import {
  generateSignatureHTML,
  collectAssetSpecs,
  plainTextSignature,
  normalize,
  TEMPLATES,
} from "@/features/signatures/lib/signatureTemplates";
import { useSignatureAssets } from "@/features/signatures/lib/assetStore";
import { copyRichHtml, downloadHtmlFile } from "@/features/signatures/lib/clipboard";

const GRADIENT_BTN = "text-white font-semibold rounded-none px-4 py-2.5 transition shadow-sm hover:shadow-md disabled:opacity-60";
const gradientStyle = { background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" };
const GMAIL_LIMIT = 10000;

const isHex = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c.trim());

export default function EditorPage() {
  const { id: routeId } = useParams();
  const id = routeId && routeId !== "new" ? routeId : null;
  const navigate = useNavigate();
  const init = useMemo(() => normalize({}, {}), []);
  const [sig, setSig] = useState(null);
  const [fields, setFields] = useState(init.f);
  const [theme, setTheme] = useState(init.t);
  const [templateId, setTemplateId] = useState("t5_rail");
  const [name, setName] = useState("Untitled signature");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [mobileTab, setMobileTab] = useState("edit");
  const [copied, setCopied] = useState(false);
  const [copyNote, setCopyNote] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [copying, setCopying] = useState(false);
  const [clients, setClients] = useState([]);
  const dirtyRef = useRef(false);
  const saveTimer = useRef(null);
  const loadedIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (id && loadedIdRef.current !== id) {
        try {
          const s = await base44.entities.Signature.get(id);
          if (cancelled) return;
          loadedIdRef.current = s.id;
          const { f, t } = normalize(s.fields || {}, s.theme || {});
          setSig(s);
          setName(s.name);
          setTemplateId(s.template_id || "t5_rail");
          setFields(f);
          setTheme(t);
        } catch (e) {
          console.error(e);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    base44.entities.CRMClient.list("business", 200)
      .then((list) => setClients((list || []).filter((c) => c.business)))
      .catch(() => setClients([]));
  }, []);

  // ---- assets (animated check, photo, icons, CTA) ----
  const specMap = useMemo(() => collectAssetSpecs({ fields, theme, template_id: templateId }), [fields, theme, templateId]);
  const onAssetSaved = useCallback((key, v) => {
    setFields((prev) => ({ ...prev, assets: { ...(prev.assets || {}), [key]: v } }));
  }, []);
  const assets = useSignatureAssets(specMap, fields.assets, onAssetSaved);

  const previewHtml = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: false });
  const finalHtml = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: true });

  useEffect(() => {
    dirtyRef.current = true;
  }, [fields, theme, templateId, name]);

  const buildPayload = () => {
    const keep = Object.fromEntries(Object.entries(fields.assets || {}).filter(([k]) => specMap[k]));
    return { name, template_id: templateId, fields: { ...fields, assets: keep }, theme, generated_html: finalHtml };
  };

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (sig) {
        setSig(await base44.entities.Signature.update(sig.id, payload));
      } else {
        const created = await base44.entities.Signature.create(payload);
        setSig(created);
        if (created && !id) {
          loadedIdRef.current = created.id;
          navigate(`/signatures/${created.id}`, { replace: true });
        }
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
    saveTimer.current = setTimeout(() => {
      if (dirtyRef.current) doSave();
    }, 2500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, theme, templateId, name, loading]);

  const handleCopy = async () => {
    setCopying(true);
    setCopyNote("");
    let html = finalHtml;
    let ok;
    if (assets.pending > 0) {
      await assets.ensureAll();
      html = generateSignatureHTML({ fields, theme, template_id: templateId, assets, final: true });
    }
    ok = await copyRichHtml(html, plainTextSignature(fields));
    setCopying(false);
    if (ok) {
      setCopied(true);
      setShowInstall(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopyNote("Animations are ready. Click Copy again.");
    }
  };

  const fillFromClient = async (clientId) => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    const patch = {
      client_id: c.id,
      company_name: c.business || fields.company_name,
      full_name: c.contact_name || fields.full_name,
      phone: (c.phones || [])[0] || "",
      phone_show: !!(c.phones || [])[0],
      email: (c.emails || [])[0] || "",
      email_show: !!(c.emails || [])[0],
      website: c.domain || "",
      website_show: !!c.domain,
      logo_url: c.logo_url || fields.logo_url,
    };
    let themePatch = {};
    try {
      const [d] = await base44.entities.ClientDossier.filter({ client_id: c.id });
      const colors = (d?.brand_identity?.colors || []).map((x) => (typeof x === "string" ? x : x?.hex)).filter(isHex);
      const accent = colors.find((x) => !/^#(f{6}|0{6}|1c1c1c|f0f0eb)$/i.test(x));
      if (accent) themePatch = { accent_color: accent, accent_color_2: colors.find((x) => x !== accent && isHex(x) && x.toLowerCase() !== "#ffffff") || accent };
      if (d?.brand_identity?.logo_url) patch.logo_url = d.brand_identity.logo_url;
      if (d?.tagline) patch.slogan = d.tagline;
    } catch {
      /* no dossier */
    }
    setFields((prev) => ({ ...prev, ...patch }));
    if (Object.keys(themePatch).length) setTheme((prev) => ({ ...prev, ...themePatch }));
    if (name === "Untitled signature") setName(`${c.business} signature`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)] md:h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-[#ff3c00]" />
      </div>
    );
  }

  const chars = finalHtml.length;

  return (
    <div className="h-[calc(100vh-3rem)] md:h-screen flex flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 px-4 min-h-14 py-2 border-b border-border shrink-0">
        <Link to="/signatures" className="text-muted-foreground hover:text-foreground transition" title="Back to signatures">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 max-w-xs font-medium" aria-label="Signature name" />
        <select
          value={fields.client_id || ""}
          onChange={(e) => fillFromClient(e.target.value)}
          className="h-9 rounded-sm border border-border bg-background px-2 text-sm max-w-[200px]"
          title="Fill name, contact info, logo and brand colors from a client"
        >
          <option value="">Fill from client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.business}
            </option>
          ))}
        </select>
        <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
          {assets.pending > 0 ? (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#ff6a00]" /> Rendering animations… {assets.pending} left
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
          <button onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground transition px-2">
            Advanced
          </button>
          <Button variant="outline" size="sm" onClick={doSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <button onClick={handleCopy} disabled={copying} className={GRADIENT_BTN + " text-sm inline-flex items-center"} style={gradientStyle}>
            {copying ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : copied ? (
              <Check className="w-4 h-4 mr-1.5" />
            ) : (
              <Copy className="w-4 h-4 mr-1.5" />
            )}
            {copying ? "Preparing…" : copied ? "Copied!" : "Copy Signature"}
          </button>
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
            className={`flex-1 py-2 text-sm font-medium capitalize ${
              mobileTab === t ? "text-[#ff3c00] border-b-2 border-[#ff3c00]" : "text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full sm:w-[420px] sm:shrink-0 overflow-y-auto border-r border-border ${mobileTab === "edit" ? "block" : "hidden"} sm:block`}>
          <div className="px-5 pt-5">
            <label className="block mb-1 font-medium text-xs uppercase tracking-wider text-muted-foreground">Template</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`text-left rounded-none border p-3 transition ${
                    templateId === t.id ? "border-[#ff3c00] bg-[#fff1ea]" : "border-border hover:bg-muted"
                  }`}
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

      <InstallInstructionsModal open={showInstall} onOpenChange={setShowInstall} />
    </div>
  );
}

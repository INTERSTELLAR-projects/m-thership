import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy, Download, Code, Check, Loader2 } from "lucide-react";
import SignatureForm from "@/features/signatures/editor/SignatureForm";
import SignaturePreview from "@/features/signatures/editor/SignaturePreview";
import InstallInstructionsModal from "@/features/signatures/InstallInstructionsModal";
import { generateSignatureHTML, plainTextSignature, DEFAULT_FIELDS, DEFAULT_THEME, TEMPLATES } from "@/features/signatures/lib/signatureTemplates";
import { copyRichHtml, downloadHtmlFile } from "@/features/signatures/lib/clipboard";

const GRADIENT_BTN =
  "text-white font-semibold rounded-none px-4 py-2.5 transition shadow-sm hover:shadow-md disabled:opacity-60";
const gradientStyle = { background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" };

export default function EditorPage() {
  const { id: routeId } = useParams();
  // "/signatures/new" (or no id) means a brand-new signature, created on first save.
  const id = routeId && routeId !== "new" ? routeId : null;
  const navigate = useNavigate();
  const [sig, setSig] = useState(null);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [templateId, setTemplateId] = useState("t1_classic");
  const [name, setName] = useState("Untitled signature");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [mobileTab, setMobileTab] = useState("edit");
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [copying, setCopying] = useState(false);
  const dirtyRef = useRef(false);
  const saveTimer = useRef(null);
  const loadedIdRef = useRef(null);

  // Load existing signature
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Skip reloading right after a new signature was created and the URL was swapped to its id.
      if (id && loadedIdRef.current !== id) {
        try {
          const s = await base44.entities.Signature.get(id);
          if (cancelled) return;
          loadedIdRef.current = s.id;
          setSig(s);
          setName(s.name);
          setTemplateId(s.template_id || "t1_classic");
          setFields({ ...DEFAULT_FIELDS, ...(s.fields || {}), social: { ...DEFAULT_FIELDS.social, ...((s.fields || {}).social || {}) }, cta: { ...DEFAULT_FIELDS.cta, ...((s.fields || {}).cta || {}) } });
          setTheme({ ...DEFAULT_THEME, ...(s.theme || {}) });
        } catch (e) {
          console.error(e);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const html = useMemo(
    () => generateSignatureHTML({ fields, theme, template_id: templateId }),
    [fields, theme, templateId]
  );

  // Mark dirty whenever content changes
  useEffect(() => { dirtyRef.current = true; }, [fields, theme, templateId, name]);

  // Auto-save (debounced, every few seconds while editing)
  useEffect(() => {
    if (loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (dirtyRef.current) doSave();
    }, 2500);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [fields, theme, templateId, name, loading]);

  const doSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { name, template_id: templateId, fields, theme, generated_html: html };
      if (sig) {
        const updated = await base44.entities.Signature.update(sig.id, payload);
        setSig(updated);
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

  const handleCopy = async () => {
    setCopying(true);
    const ok = await copyRichHtml(html, plainTextSignature(fields));
    setCopying(false);
    if (ok) {
      setCopied(true);
      setShowInstall(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3rem)] md:h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-[#ff3c00]" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] md:h-screen flex flex-col bg-background">
      {/* Editor toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 min-h-14 py-2 border-b border-border shrink-0">
        <Link to="/signatures" className="text-muted-foreground hover:text-foreground transition" title="Back to signatures">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 max-w-xs font-medium"
          aria-label="Signature name"
        />
        <div className="text-xs text-muted-foreground hidden sm:block">
          {saving ? "Saving…" : savedAt ? "Saved" : "Auto-save on"}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground transition px-2"
          >
            Advanced
          </button>
          <Button variant="outline" size="sm" onClick={doSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <button
            onClick={handleCopy}
            disabled={copying}
            className={GRADIENT_BTN + " text-sm inline-flex items-center"}
            style={gradientStyle}
          >
            {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
            {copied ? "Copied!" : "Copy Signature"}
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-[#fff1ea]/50 text-sm">
          <span className="text-muted-foreground">Advanced:</span>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(html)}>
            <Code className="w-3.5 h-3.5 mr-1" /> Copy HTML source
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadHtmlFile(html, `${name || "signature"}.html`)}>
            <Download className="w-3.5 h-3.5 mr-1" /> Download .html
          </Button>
        </div>
      )}

      {/* Mobile tabs */}
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

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`w-full sm:w-[420px] sm:shrink-0 overflow-y-auto border-r border-border ${mobileTab === "edit" ? "block" : "hidden"} sm:block`}>
          <div className="px-5 pt-5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Template</Label>
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
          <SignatureForm fields={fields} theme={theme} onFields={setFields} onTheme={setTheme} onUpload={() => {}} />
        </div>
        <div className={`flex-1 ${mobileTab === "preview" ? "block" : "hidden"} sm:block`}>
          <SignaturePreview html={html} templateId={templateId} />
        </div>
      </div>

      <InstallInstructionsModal open={showInstall} onOpenChange={setShowInstall} />
    </div>
  );
}

function Label({ className, children }) {
  return <label className={`block mb-1 font-medium ${className || ""}`}>{children}</label>;
}

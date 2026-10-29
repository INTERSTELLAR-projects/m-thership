import { useState, useEffect, useRef } from "react";
import { Search, Upload, Pin, FileText, Folder, Trash2, ExternalLink, X, Pencil, Check, Loader2, Plus, Eye, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import FormEditor from "../components/FormEditor";
import FormPreview from "../components/FormPreview";

const CATEGORIES = [
  "Internal Processes",
  "Service Documents",
  "Contracts & Agreements",
  "Presentations",
  "Legal Documents",
  "Financial Documents",
];

export default function Documents() {
   const [tab, setTab] = useState("documents");
   const [docs, setDocs] = useState([]);
   const [forms, setForms] = useState([]);
   const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    Promise.all([
      base44.entities.AppDocument.list("-created_date", 500),
      base44.entities.FormTemplate.list("-created_date", 500)
    ]).then(([docs, forms]) => {
      setDocs(docs);
      setForms(forms);
      setLoading(false);
    });
  }, []);

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = docs.filter((d) => d.category === cat).length;
    return acc;
  }, {});

  const filtered = docs.filter((doc) => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "All") return matchSearch;
    if (activeFilter === "Pinned") return matchSearch && doc.pinned;
    return matchSearch && doc.category === activeFilter;
  });

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPendingFiles(files);
    setShowUploadModal(true);
    e.target.value = "";
  };

  const handleUpload = async () => {
    setUploading(true);
    for (const file of pendingFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const created = await base44.entities.AppDocument.create({
        name: file.name,
        category: uploadCategory,
        url: file_url,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        pinned: false,
      });
      setDocs((prev) => [...prev, created]);
    }
    setUploading(false);
    setShowUploadModal(false);
    setPendingFiles([]);
  };

  const togglePin = async (doc) => {
    await base44.entities.AppDocument.update(doc.id, { pinned: !doc.pinned });
    setDocs((prev) => prev.map((d) => d.id === doc.id ? { ...d, pinned: !d.pinned } : d));
  };

  const deleteDoc = async (id) => {
    await base44.entities.AppDocument.delete(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const saveRename = async (id) => {
    if (!renameValue.trim()) return;
    await base44.entities.AppDocument.update(id, { name: renameValue.trim() });
    setDocs((prev) => prev.map((d) => d.id === id ? { ...d, name: renameValue.trim() } : d));
    setRenamingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Documents" rightText="Document Management" />
      <div className="px-8 py-6 space-y-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="bg-card border border-ink/[0.13] mb-6">
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58]">Documents</TabsTrigger>
            <TabsTrigger value="forms" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58]">Forms</TabsTrigger>
          </TabsList>
          <TabsContent value="documents" className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-9" />
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => fileRef.current.click()} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold h-9 gap-2"><Upload className="w-4 h-4" />Upload</Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => setActiveFilter(activeFilter === cat ? "All" : cat)} className={`relative overflow-hidden bg-card rounded-md border p-4 text-left transition-all card-hover ${activeFilter === cat ? "border-orange-500/40 bg-orange-500/[0.06]" : "border-ink/[0.13]"}`}>
              <div className="relative flex items-center justify-between mb-2"><Folder className="w-4 h-4 text-orange-600" /><span className="text-orange-600 text-sm font-display font-bold">{categoryCounts[cat] || 0}</span></div>
              <p className="relative text-ink/80 text-sm font-medium">{cat}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["All", "Pinned"].map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeFilter === f ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-md border border-ink/[0.13] p-10 text-center">
            <Folder className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
            <p className="text-ink/[0.48] text-sm">{activeFilter === "All" ? "No documents yet. Upload your first file." : `No documents in ${activeFilter}.`}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div key={doc.id} className="card-hover relative overflow-hidden bg-card rounded-md border border-ink/[0.13] p-4 flex items-center gap-4 group">
                <button onClick={() => window.open(doc.url, "_blank")} className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center shrink-0 hover:from-orange-500/30 hover:to-yellow-400/20 transition-all"><FileText className="w-4 h-4 text-orange-600" /></button>
                <div className="flex-1 min-w-0">
                  {renamingId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveRename(doc.id); if (e.key === "Escape") setRenamingId(null); }} className="bg-ink/[0.06] border border-orange-500/30 rounded-md px-2 py-0.5 text-sm text-ink outline-none w-64" />
                      <button onClick={() => saveRename(doc.id)} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setRenamingId(null)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => window.open(doc.url, "_blank")} className="flex items-center gap-2 text-left hover:text-orange-600 transition-colors">
                      <span className="text-ink/85 text-sm font-medium truncate">{doc.name}</span>
                      <ExternalLink className="w-3 h-3 text-ink/[0.38] shrink-0" />
                      {doc.pinned && <Pin className="w-3 h-3 text-orange-500/50 shrink-0" />}
                    </button>
                  )}
                  <p className="text-ink/[0.43] text-xs mt-0.5">{doc.category} · {doc.date}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => { setRenamingId(doc.id); setRenameValue(doc.name); }} className="p-1.5 rounded-md text-ink/[0.38] hover:text-ink/50 hover:bg-ink/5 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => togglePin(doc)} className={`p-1.5 rounded-md transition-all ${doc.pinned ? "text-orange-500/60 hover:text-orange-500" : "text-ink/[0.38] hover:text-ink/50 hover:bg-ink/5"}`}><Pin className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteDoc(doc.id)} className="p-1.5 rounded-md text-ink/[0.38] hover:text-red-600/60 hover:bg-ink/5 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            </div>
            )}
            </TabsContent>
            <TabsContent value="forms">
            <FormsList forms={forms} setForms={setForms} />
            </TabsContent>
            </Tabs>
            </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center">
          <div className="bg-card border border-ink/[0.13] rounded-md p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-ink font-bold text-sm">Upload Documents</h3>
              <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} className="text-ink/[0.48] hover:text-ink/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">{pendingFiles.map((f, i) => <p key={i} className="text-ink/50 text-xs truncate">📄 {f.name}</p>)}</div>
            <div>
              <p className="text-ink/[0.58] text-xs mb-1.5">Category</p>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setUploadCategory(cat)} className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${uploadCategory === cat ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-ink/[0.48] hover:text-ink/50 border border-ink/[0.13]"}`}>{cat}</button>
                ))}
              </div>
            </div>
            <Button onClick={handleUpload} disabled={uploading} className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold">{uploading ? "Uploading..." : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}</Button>
          </div>
        </div>
      )}
      </div>
      );
      }

      function FormsList({ forms, setForms }) {
      const [showFormBuilder, setShowFormBuilder] = useState(false);
      const [editingForm, setEditingForm] = useState(null);
      const [previewForm, setPreviewForm] = useState(null);
      const [selectedType, setSelectedType] = useState("intake");

      const handleDeleteForm = async (id) => {
      await base44.entities.FormTemplate.delete(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
      };

      const handlePublish = async (form) => {
      const updated = { ...form, published: true, publishedDate: new Date().toISOString() };
      await base44.entities.FormTemplate.update(form.id, { published: true, publishedDate: updated.publishedDate });
      setForms((prev) => prev.map((f) => f.id === form.id ? updated : f));
      };

      return (
      <div className="space-y-6">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSelectedType("intake")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === "intake" ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-ink/[0.58] hover:text-ink/60 border border-transparent"}`}>Intake Forms</button>
        <button onClick={() => setSelectedType("request")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === "request" ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-ink/[0.58] hover:text-ink/60 border border-transparent"}`}>Request Forms</button>
      </div>

      <div className="flex items-center justify-between">
       <h3 className="text-ink font-bold text-sm">{selectedType === "request" ? "Request" : "Intake"} Forms</h3>
       <Button onClick={() => { setEditingForm(null); setShowFormBuilder(true); }} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold h-9 gap-2"><Plus className="w-4 h-4" />New Form</Button>
      </div>

      {forms.filter(f => (f.formType || "request") === selectedType).length === 0 ? (
       <div className="bg-card rounded-md border border-ink/[0.13] p-10 text-center">
         <FileText className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
         <p className="text-ink/[0.48] text-sm">No request forms yet. Create one to get started.</p>
       </div>
      ) : (
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {forms.filter(f => (f.formType || "request") === selectedType).map((form) => (
           <div key={form.id} className="card-hover relative overflow-hidden bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
           <div>
             <h4 className="text-ink font-bold text-sm">{form.title}</h4>
             <p className="text-ink/[0.58] text-xs mt-1">{form.subtitle}</p>
             <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-1 rounded ${ form.published ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}`}>
               {form.published ? "Published" : "Draft"}
             </span>
           </div>
           <div className="flex items-center gap-2">
             <button onClick={() => { setEditingForm(form); setShowFormBuilder(true); }} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-ink/[0.04] text-ink/60 hover:bg-ink/[0.08] transition-all flex items-center justify-center gap-1.5"><Pencil className="w-3 h-3" />Edit</button>
             {form.published && <button onClick={() => setPreviewForm(form)} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1.5"><Eye className="w-3 h-3" />Preview</button>}
             {!form.published && <button onClick={() => handlePublish(form)} className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-all flex items-center justify-center gap-1.5"><Eye className="w-3 h-3" />Publish</button>}
             <button onClick={() => handleDeleteForm(form.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg text-ink/[0.38] hover:text-red-600 transition-all"><Trash2 className="w-3 h-3" /></button>
           </div>
           </div>
         ))}
       </div>
      )}

      {showFormBuilder && (
       <FormBuilder form={editingForm} formType={selectedType} onClose={() => setShowFormBuilder(false)} onSave={(form) => {
          if (editingForm) {
            setForms((prev) => prev.map((f) => f.id === form.id ? form : f));
          } else {
            setForms((prev) => [...prev, form]);
          }
          setShowFormBuilder(false);
          setEditingForm(null);
        }} />
      )}

      {previewForm && (
       <FormPreview form={previewForm} onClose={() => setPreviewForm(null)} />
      )}
      </div>
      );
      }

      function FormBuilder({ form, formType, onClose, onSave }) {
      const [step, setStep] = useState(form?.id ? "builder" : "basic"); // 'basic' or 'builder'
      const [title, setTitle] = useState(form?.title || "");
      const [subtitle, setSubtitle] = useState(form?.subtitle || "");
      const [category, setCategory] = useState(form?.category || "Web Øps");
      const [fields, setFields] = useState(form?.fields || []);
      const [saving, setSaving] = useState(false);

      const handleSave = async () => {
      if (!title.trim() || fields.length === 0) return;
      setSaving(true);
      const formData = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      category,
      formType: formType || "request",
      fields: fields.map(f => ({
        ...f,
        acceptedTypes: f.type === "file_upload" ? ["images", "videos", "documents", "pdf"] : undefined,
        multiple: f.type === "file_upload" ? true : undefined,
      })),
      published: form?.published || false,
      };
      if (form?.id) {
      const { id, created_date, updated_date, created_by, ...rest } = form;
      await base44.entities.FormTemplate.update(form.id, { ...formData, published: form.published, publishedDate: form.publishedDate });
      onSave({ ...form, ...formData, published: form.published, publishedDate: form.publishedDate });
      } else {
      const created = await base44.entities.FormTemplate.create(formData);
      onSave(created);
      }
      setSaving(false);
      };

      if (step === "builder") {
      return (
      <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center">
      <div className="bg-card border border-ink/[0.13] rounded-md p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <button onClick={() => setStep("basic")} className="text-ink/[0.58] hover:text-ink/70 transition-colors">
             <ArrowLeft className="w-4 h-4" />
           </button>
           <h3 className="text-ink font-bold text-sm">Form Builder</h3>
         </div>
         <button onClick={onClose} className="text-ink/[0.48] hover:text-ink/60"><X className="w-4 h-4" /></button>
       </div>
       <FormEditor fields={fields} setFields={setFields} />
       <div className="flex gap-2 pt-2">
         <Button onClick={() => setStep("basic")} variant="outline" className="flex-1">Back</Button>
         <Button onClick={handleSave} disabled={!title.trim() || fields.length === 0 || saving} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold">{saving ? "Saving..." : "Save Form"}</Button>
       </div>
      </div>
      </div>
      );
      }

      return (
      <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center">
      <div className="bg-card border border-ink/[0.13] rounded-md p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
       <div className="flex items-center justify-between">
         <h3 className="text-ink font-bold text-sm">{form ? "Edit Form" : "Create Form"}</h3>
         <button onClick={onClose} className="text-ink/[0.48] hover:text-ink/60"><X className="w-4 h-4" /></button>
       </div>
       <div className="space-y-3">
         <div>
           <label className="text-ink/[0.58] text-xs font-medium block mb-1.5">Form Title *</label>
           <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="e.g. Web Øps Website Update Request" />
         </div>
         <div>
           <label className="text-ink/[0.58] text-xs font-medium block mb-1.5">Subtitle (optional)</label>
           <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="bg-ink/[0.03] border-ink/[0.13] text-ink" placeholder="Brief description" />
         </div>
         <div>
           <label className="text-ink/[0.58] text-xs font-medium block mb-1.5">Category *</label>
           <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded px-3 py-2 text-ink text-sm outline-none">
             {["Web Øps", "Førge", "Ørbit SEO", "Performance", "Other"].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
           </select>
         </div>
       </div>
       <div className="flex gap-2 pt-2">
         <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
         <Button onClick={() => setStep("builder")} disabled={!title.trim()} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold">Continue to Builder</Button>
       </div>
      </div>
      </div>
      );
      }
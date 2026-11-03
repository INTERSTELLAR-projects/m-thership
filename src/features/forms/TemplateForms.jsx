import { useState } from "react";
import { FileText, Pencil, Trash2, Eye, Plus, X, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import FormEditor from "@/components/FormEditor";
import FormPreview from "@/components/FormPreview";

// Shared FormTemplate forms (formType "intake" | "request"): the Ignition intake, legacy shared request templates.
// Moved out of pages/Documents.jsx unchanged in behaviour; editing / preview / publish all work as before.
export default function TemplateFormsList({ forms, setForms, formType, appliesTo, emptyText }) {
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [previewForm, setPreviewForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const list = forms.filter((f) => (f.formType || "request") === formType);

  const handleDeleteForm = async (id) => {
    await base44.entities.FormTemplate.delete(id);
    setForms((prev) => prev.filter((f) => f.id !== id));
    setConfirmDelete(null);
  };

  const handlePublish = async (form) => {
    const updated = { ...form, published: true, publishedDate: new Date().toISOString() };
    await base44.entities.FormTemplate.update(form.id, { published: true, publishedDate: updated.publishedDate });
    setForms((prev) => prev.map((f) => (f.id === form.id ? updated : f)));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingForm(null); setShowFormBuilder(true); }} className="h-9 gap-2 bg-gradient-to-r from-orange-500 to-amber-400 font-semibold text-white hover:from-orange-400 hover:to-amber-300"><Plus className="h-4 w-4" />New {formType === "intake" ? "intake" : "shared"} form</Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-ink/[0.13] bg-card p-10 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-ink/[0.28]" />
          <p className="text-sm text-ink/[0.48]">{emptyText || "No forms yet. Create one to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((form) => {
            const applies = appliesTo ? appliesTo(form) : "";
            return (
              <div key={form.id} className="card-hover relative space-y-3 overflow-hidden rounded-md border border-ink/[0.13] bg-card p-5">
                <div>
                  <h4 className="text-sm font-bold text-ink">{form.title}</h4>
                  <p className="mt-1 text-xs text-ink/[0.58]">{form.subtitle}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-block rounded px-2 py-1 text-[10px] font-semibold ${form.published ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"}`}>{form.published ? "Published" : "Draft"}</span>
                    <span className="text-[10.5px] text-ink/45">{(form.fields || []).length} questions · {form.category}</span>
                  </div>
                  {applies ? <p className="mt-2 text-[11.5px] text-ink/60"><span className="mono-label mr-1 text-[8.5px] text-[#ff3c00]">Applies to</span>{applies}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setEditingForm(form); setShowFormBuilder(true); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink/[0.04] px-3 py-1.5 text-xs font-medium text-ink/60 transition-all hover:bg-ink/[0.08]"><Pencil className="h-3 w-3" />Edit</button>
                  {form.published && <button type="button" onClick={() => setPreviewForm(form)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-600 transition-all hover:bg-blue-500/20"><Eye className="h-3 w-3" />Preview</button>}
                  {!form.published && <button type="button" onClick={() => handlePublish(form)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-600 transition-all hover:bg-orange-500/20"><Eye className="h-3 w-3" />Publish</button>}
                  {confirmDelete === form.id ? (
                    <>
                      <button type="button" onClick={() => handleDeleteForm(form.id)} className="rounded-lg bg-red-600/10 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-600/20">Delete</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="px-1.5 py-1.5 text-xs text-ink/50 hover:text-ink">Keep</button>
                    </>
                  ) : (
                    <button type="button" title="Delete" onClick={() => setConfirmDelete(form.id)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/[0.38] transition-all hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showFormBuilder && (
        <TemplateFormBuilder
          form={editingForm}
          formType={formType}
          onClose={() => setShowFormBuilder(false)}
          onSave={(form) => {
            if (editingForm) setForms((prev) => prev.map((f) => (f.id === form.id ? form : f)));
            else setForms((prev) => [...prev, form]);
            setShowFormBuilder(false);
            setEditingForm(null);
          }}
        />
      )}

      {previewForm && <FormPreview form={previewForm} onClose={() => setPreviewForm(null)} />}
    </div>
  );
}

function TemplateFormBuilder({ form, formType, onClose, onSave }) {
  const [step, setStep] = useState(form?.id ? "builder" : "basic");
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
      fields: fields.map((f) => ({
        ...f,
        acceptedTypes: f.type === "file_upload" ? ["images", "videos", "documents", "pdf"] : undefined,
        multiple: f.type === "file_upload" ? true : undefined,
      })),
      published: form?.published || false,
    };
    try {
      if (form?.id) {
        await base44.entities.FormTemplate.update(form.id, { ...formData, published: form.published, publishedDate: form.publishedDate });
        onSave({ ...form, ...formData, published: form.published, publishedDate: form.publishedDate });
      } else {
        const created = await base44.entities.FormTemplate.create(formData);
        onSave(created);
      }
    } finally {
      setSaving(false);
    }
  };

  if (step === "builder") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-md border border-ink/[0.13] bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStep("basic")} className="text-ink/[0.58] transition-colors hover:text-ink/70"><ArrowLeft className="h-4 w-4" /></button>
              <h3 className="text-sm font-bold text-ink">Form Builder</h3>
            </div>
            <button type="button" onClick={onClose} className="text-ink/[0.48] hover:text-ink/60"><X className="h-4 w-4" /></button>
          </div>
          <FormEditor fields={fields} setFields={setFields} />
          <div className="flex gap-2 pt-2">
            <Button onClick={() => setStep("basic")} variant="outline" className="flex-1">Back</Button>
            <Button onClick={handleSave} disabled={!title.trim() || fields.length === 0 || saving} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 font-semibold text-white hover:from-orange-400 hover:to-amber-300">{saving ? "Saving..." : "Save Form"}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-md border border-ink/[0.13] bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">{form ? "Edit Form" : "Create Form"}</h3>
          <button type="button" onClick={onClose} className="text-ink/[0.48] hover:text-ink/60"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/[0.58]">Form Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-ink/[0.13] bg-ink/[0.03] text-ink" placeholder="e.g. Web Øps Website Update Request" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/[0.58]">Subtitle (optional)</label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="border-ink/[0.13] bg-ink/[0.03] text-ink" placeholder="Brief description" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/[0.58]">Category *</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded border border-ink/[0.13] bg-ink/[0.03] px-3 py-2 text-sm text-ink outline-none">
              {["Web Øps", "Førge", "HyperCare+", "GravïtyCare", "Performance", "Other"].map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button onClick={() => setStep("builder")} disabled={!title.trim()} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-400 font-semibold text-white hover:from-orange-400 hover:to-amber-300">Continue to Builder</Button>
        </div>
      </div>
    </div>
  );
}

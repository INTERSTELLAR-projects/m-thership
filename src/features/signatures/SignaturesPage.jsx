import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Copy as CopyIcon, Pencil, Trash2, Loader2, FileText } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { generateSignatureHTML, TEMPLATES } from "@/features/signatures/lib/signatureTemplates";

const gradientStyle = { background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" };

function timeAgo(date) {
  if (!date) return "—";
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function SignaturesPage() {
  const navigate = useNavigate();
  const [sigs, setSigs] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const load = async () => {
    try {
      const list = await base44.entities.Signature.list("-updated_date", 100);
      setSigs(list);
    } catch (e) {
      console.error(e);
      setSigs([]);
    }
  };
  useEffect(() => { load(); }, []);

  // The editor creates the record on first save when opened at /signatures/new.
  const createNew = () => navigate("/signatures/new");

  const duplicate = async (s) => {
    await base44.entities.Signature.create({
      name: s.name + " (copy)",
      template_id: s.template_id,
      fields: s.fields,
      theme: s.theme,
      generated_html: s.generated_html,
    });
    load();
  };

  const remove = async (s) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    await base44.entities.Signature.delete(s.id);
    load();
  };

  const doRename = async () => {
    if (renaming) {
      await base44.entities.Signature.update(renaming.id, { name: renameVal });
      setRenaming(null);
      load();
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Tools / Email Signatures" rightText="Føøtprint">
        <button
          onClick={createNew}
          className="text-white text-sm font-semibold rounded-none px-4 py-2.5 inline-flex items-center shadow-sm hover:shadow-md transition"
          style={gradientStyle}
        >
          <Plus className="w-4 h-4 mr-1.5" /> New signature
        </button>
      </PageHeader>

      <div className="px-5 py-6 md:px-8">
        <p className="text-sm text-muted-foreground mb-6">Create, edit, and copy animated HTML email signatures.</p>

        {sigs === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#ff3c00]" />
          </div>
        ) : sigs.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-hair rounded-none bg-white/60">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">No signatures yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first animated email signature.</p>
            <button
              onClick={createNew}
              className="text-white text-sm font-semibold rounded-none px-4 py-2.5 inline-flex items-center"
              style={gradientStyle}
            >
              <Plus className="w-4 h-4 mr-1.5" /> New signature
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sigs.map((s) => {
              const tpl = TEMPLATES.find((t) => t.id === s.template_id);
              const html = s.generated_html || generateSignatureHTML({ fields: s.fields || {}, theme: s.theme || {}, template_id: s.template_id });
              return (
                <div key={s.id} className="group bg-background border border-border rounded-none overflow-hidden hover:shadow-md transition">
                  <div
                    className="h-40 bg-muted/40 flex items-center justify-center p-4 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/signatures/${s.id}`)}
                  >
                    <div className="origin-top-left scale-[0.7] max-w-full" dangerouslySetInnerHTML={{ __html: html }} />
                  </div>
                  <div className="p-4">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {tpl?.name || "Template"} · {timeAgo(s.updated_date)}
                    </div>
                    <div className="flex items-center gap-1 mt-3">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/signatures/${s.id}`)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => duplicate(s)}>
                        <CopyIcon className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setRenaming(s); setRenameVal(s.name); }}>
                        Rename
                      </Button>
                      <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={() => remove(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename signature</DialogTitle>
          </DialogHeader>
          <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} className="h-10" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={doRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

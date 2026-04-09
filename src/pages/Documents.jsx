import { useState, useRef } from "react";
import { Search, Upload, Pin, FileText, Folder, Trash2, ExternalLink, X, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";

const CATEGORIES = [
  "Internal Processes",
  "Service Documents",
  "Contracts & Agreements",
  "Presentations",
  "Legal Documents",
  "Financial Documents",
];

function loadDocs() {
  try { return JSON.parse(localStorage.getItem("ic_documents") || "[]"); } catch { return []; }
}
function saveDocs(docs) { localStorage.setItem("ic_documents", JSON.stringify(docs)); }

export default function Documents() {
  const [docs, setDocs] = useState(() => loadDocs());
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [uploading, setUploading] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileRef = useRef();

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
    const newDocs = [];
    for (const file of pendingFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newDocs.push({
        id: Date.now() + Math.random(),
        name: file.name,
        category: uploadCategory,
        url: file_url,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        pinned: false,
        type: file.type,
        size: file.size,
      });
    }
    const updated = [...docs, ...newDocs];
    setDocs(updated);
    saveDocs(updated);
    setUploading(false);
    setShowUploadModal(false);
    setPendingFiles([]);
  };

  const togglePin = (id) => {
    const updated = docs.map((d) => d.id === id ? { ...d, pinned: !d.pinned } : d);
    setDocs(updated);
    saveDocs(updated);
  };

  const deleteDoc = (id) => {
    const updated = docs.filter((d) => d.id !== id);
    setDocs(updated);
    saveDocs(updated);
  };

  const openDoc = (doc) => {
    window.open(doc.url, "_blank");
  };

  const startRename = (doc) => {
    setRenamingId(doc.id);
    setRenameValue(doc.name);
  };

  const saveRename = (id) => {
    if (!renameValue.trim()) return;
    const updated = docs.map((d) => d.id === id ? { ...d, name: renameValue.trim() } : d);
    setDocs(updated);
    saveDocs(updated);
    setRenamingId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Documents" rightText="Document Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9"
            />
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <Button onClick={() => fileRef.current.click()} className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(activeFilter === cat ? "All" : cat)}
              className={`bg-card rounded-xl border p-4 text-left transition-all hover:border-orange-500/20 ${
                activeFilter === cat ? "border-orange-500/30 bg-orange-500/[0.03]" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Folder className="w-4 h-4 text-orange-500/50" />
                <span className="text-white/20 text-xs font-medium">{categoryCounts[cat] || 0}</span>
              </div>
              <p className="text-white/70 text-sm font-medium">{cat}</p>
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {["All", "Pinned"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === f
                  ? "bg-orange-500/15 text-orange-500 border border-orange-500/20"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Document List */}
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-white/[0.06] p-10 text-center">
            <Folder className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">
              {activeFilter === "All" ? "No documents yet. Upload your first file." : `No documents in ${activeFilter}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-4 group hover:border-orange-500/15 transition-all"
              >
                <button onClick={() => openDoc(doc)} className="w-9 h-9 rounded-lg bg-orange-500/[0.06] flex items-center justify-center shrink-0 hover:bg-orange-500/10 transition-all">
                  <FileText className="w-4 h-4 text-orange-500/40" />
                </button>
                <div className="flex-1 min-w-0">
                  {renamingId === doc.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(doc.id); if (e.key === "Escape") setRenamingId(null); }}
                      className="bg-white/[0.06] border border-orange-500/30 rounded-md px-2 py-0.5 text-sm text-white outline-none w-64"
                    />
                    <button onClick={() => saveRename(doc.id)} className="p-1 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setRenamingId(null)} className="p-1 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                <button onClick={() => openDoc(doc)} className="flex items-center gap-2 text-left hover:text-orange-400/80 transition-colors">
                    <span className="text-white/85 text-sm font-medium truncate">{doc.name}</span>
                    <ExternalLink className="w-3 h-3 text-white/20 shrink-0" />
                    {doc.pinned && <Pin className="w-3 h-3 text-orange-500/50 shrink-0" />}
                  </button>
                )}
                  <p className="text-white/25 text-xs mt-0.5">{doc.category} · {doc.date}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => startRename(doc)}
                    className="p-1.5 rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => togglePin(doc.id)}
                    className={`p-1.5 rounded-md transition-all ${doc.pinned ? "text-orange-500/60 hover:text-orange-500" : "text-white/20 hover:text-white/50 hover:bg-white/5"}`}
                    title={doc.pinned ? "Unpin" : "Pin"}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteDoc(doc.id)}
                    className="p-1.5 rounded-md text-white/20 hover:text-red-400/60 hover:bg-white/5 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-card border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">Upload Documents</h3>
              <button onClick={() => { setShowUploadModal(false); setPendingFiles([]); }} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              {pendingFiles.map((f, i) => (
                <p key={i} className="text-white/50 text-xs truncate">📄 {f.name}</p>
              ))}
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1.5">Category</p>
              <div className="grid grid-cols-2 gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                      uploadCategory === cat
                        ? "bg-orange-500/15 text-orange-500 border border-orange-500/20"
                        : "text-white/30 hover:text-white/50 border border-white/[0.06]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
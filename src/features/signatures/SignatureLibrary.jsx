import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Copy as CopyIcon, FolderInput, Star, Loader2, Search, LayoutTemplate, PenLine, Folder } from "lucide-react";

const gradientStyle = { background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" };

function timeAgo(date) {
  if (!date) return "";
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function Thumb({ html }) {
  return (
    <div className="h-40 overflow-hidden bg-white border-b border-border relative">
      <div className="origin-top-left pointer-events-none p-4" style={{ transform: "scale(0.6)", width: "166%" }} dangerouslySetInnerHTML={{ __html: html || "" }} />
      {!html && <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Open to render the preview</div>}
    </div>
  );
}

/**
 * Signatures + templates library, organized by client folder and project.
 * Used by the admin (all clients) and the client portal (their own folder + Interstellar templates).
 */
export default function SignatureLibrary({ store, clients = [], initialTab = "signatures", onOpen, onNew, onOpenTemplate, onNewTemplate }) {
  const portal = store.kind === "portal";
  const [tab, setTab] = useState(initialTab);
  const [sigs, setSigs] = useState(null);
  const [tpls, setTpls] = useState(null);
  const [client, setClient] = useState("all"); // all | internal | <client id>
  const [folder, setFolder] = useState("all");
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      const [s, t] = await Promise.all([store.listSignatures(), store.listTemplates()]);
      setSigs(s || []);
      setTpls(t || []);
    } catch (e) {
      console.error(e);
      setSigs([]);
      setTpls([]);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = tab === "signatures" ? sigs : tpls;
  const byClient = (r) => {
    if (portal || client === "all") return true;
    if (client === "internal") return !r.client_id && (tab === "signatures" || r.scope === "global");
    return r.client_id === client || (tab === "templates" && r.scope === "global");
  };
  const scoped = (rows || []).filter(byClient);
  const folders = useMemo(() => [...new Set(scoped.map((r) => r.folder).filter(Boolean))].sort(), [scoped]);
  const visible = scoped
    .filter((r) => folder === "all" || (folder === "none" ? !r.folder : r.folder === folder))
    .filter((r) => !q || `${r.name} ${r.client_name || ""} ${r.folder || ""}`.toLowerCase().includes(q.toLowerCase()));
  const clientName = (id) => clients.find((c) => c.id === id)?.business;
  const selectedClient = client !== "all" && client !== "internal" ? client : "";
  const ownTemplate = (t) => !portal || t.scope === "client";

  const move = async (r) => {
    const f = window.prompt("Move to project / folder (leave empty for none):", r.folder || "");
    if (f === null) return;
    if (tab === "signatures") await store.saveSignature(r.id, { folder: f.trim() });
    else await store.saveTemplate(r.id, { folder: f.trim() });
    load();
  };
  const remove = async (r) => {
    if (!window.confirm(`Delete "${r.name}"? This can't be undone.`)) return;
    if (tab === "signatures") await store.deleteSignature(r.id);
    else await store.deleteTemplate(r.id);
    load();
  };
  const duplicate = async (r) => {
    const base = { name: `${r.name} (copy)`, template_id: r.template_id, fields: r.fields, theme: r.theme, folder: r.folder || "" };
    if (tab === "signatures") {
      await store.saveSignature(null, { ...base, generated_html: r.generated_html, ...(portal ? {} : { client_id: r.client_id || "", client_name: r.client_name || "" }) });
    } else {
      await store.saveTemplate(null, {
        ...base,
        preview_html: r.preview_html,
        ...(portal ? {} : { scope: r.scope || "global", client_id: r.client_id || "", client_name: r.client_name || "" }),
      });
    }
    load();
  };
  const makeDefault = async (t) => {
    await store.setDefault(t);
    load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex border border-border bg-background">
          {[
            ["signatures", "Signatures", PenLine],
            ["templates", "Templates", LayoutTemplate],
          ].map(([k, l, I]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k);
                setFolder("all");
              }}
              className={`inline-flex items-center gap-1.5 px-3 h-9 text-sm ${tab === k ? "bg-[#fff1ea] text-[#ff3c00] font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <I className="w-4 h-4" /> {l}
              <span className="text-[11px] opacity-70">{(k === "signatures" ? sigs : tpls)?.length ?? ""}</span>
            </button>
          ))}
        </div>
        {!portal && (
          <select
            value={client}
            onChange={(e) => {
              setClient(e.target.value);
              setFolder("all");
            }}
            className="h-9 rounded-sm border border-border bg-background px-2 text-sm"
            title="Client folder"
          >
            <option value="all">All folders</option>
            <option value="internal">Interstellar (internal)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business}
              </option>
            ))}
          </select>
        )}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-44 pl-8" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tab === "templates" && (
            <Button variant="outline" size="sm" onClick={() => onNewTemplate?.({ clientId: selectedClient, folder: folder !== "all" && folder !== "none" ? folder : "" })}>
              <Plus className="w-4 h-4 mr-1" /> New template
            </Button>
          )}
          <button
            onClick={() => onNew?.({ clientId: selectedClient, folder: folder !== "all" && folder !== "none" ? folder : "" })}
            className="text-white font-semibold px-4 h-9 text-sm inline-flex items-center"
            style={gradientStyle}
          >
            <Plus className="w-4 h-4 mr-1" /> New signature
          </button>
        </div>
      </div>

      {(folders.length > 0 || folder !== "all") && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[["all", "All projects"], ...folders.map((f) => [f, f]), ["none", "No project"]].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFolder(k)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 text-xs border ${folder === k ? "border-[#ff3c00] bg-[#fff1ea] text-[#ff3c00]" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {k !== "all" && k !== "none" && <Folder className="w-3 h-3" />} {l}
            </button>
          ))}
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#ff3c00]" />
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          {tab === "signatures" ? "No signatures here yet. Start one — it opens with the default design." : "No templates here yet. Save any signature as a template, or create one."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => {
            const isTpl = tab === "templates";
            const owner = isTpl ? (r.scope === "global" ? "All clients" : r.client_name || clientName(r.client_id) || "Client") : r.client_name || clientName(r.client_id) || (portal ? "" : "Interstellar");
            return (
              <div key={r.id} className="border border-border bg-background flex flex-col">
                <Thumb html={isTpl ? r.preview_html : r.generated_html} />
                <div className="p-3 flex-1">
                  <div className="flex items-start gap-2">
                    <div className="font-medium text-sm truncate flex-1">{r.name}</div>
                    {isTpl && r.is_default && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-[#ff6a00]">
                        <Star className="w-3 h-3 fill-[#ff6a00]" /> Default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {owner && <span>{owner}</span>}
                    {r.folder && (
                      <span className="inline-flex items-center gap-1">
                        <Folder className="w-3 h-3" />
                        {r.folder}
                      </span>
                    )}
                    <span>{timeAgo(r.updated_date)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
                  {isTpl ? (
                    <>
                      <Button size="sm" className="h-8" style={gradientStyle} onClick={() => onNew?.({ templateId: r.id, clientId: r.client_id || selectedClient, folder: r.folder || "" })}>
                        Use
                      </Button>
                      {ownTemplate(r) && (
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => onOpenTemplate?.(r)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                      )}
                      {ownTemplate(r) && !r.is_default && (
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => makeDefault(r)} title="New signatures start from this">
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => onOpen?.(r)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => duplicate(r)} title="Duplicate">
                    <CopyIcon className="w-3.5 h-3.5" />
                  </Button>
                  {(!isTpl || ownTemplate(r)) && (
                    <>
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => move(r)} title="Move to project">
                        <FolderInput className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 ml-auto text-muted-foreground hover:text-red-600" onClick={() => remove(r)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

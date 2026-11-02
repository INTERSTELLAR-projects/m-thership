import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Download, Trash2, Zap, Lock, Folder, QrCode as QrIcon, Pause } from "lucide-react";
import QrCanvas from "./components/QrCanvas";
import ConfirmDialog from "./components/ConfirmDialog";
import { TickingNumber } from "./components/ScanStats";
import { encodedValue, previewText, isDynamic } from "./lib/content";
import { downloadPNG } from "./lib/draw";
import { DEFAULT_STYLE } from "./lib/presets";

const inputCls = "border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]";

function Card({ c, onOpen, onDelete }) {
  const [busy, setBusy] = useState(false);
  const style = { ...DEFAULT_STYLE, ...(c.style || {}) };
  const value = encodedValue(c);
  const dyn = isDynamic(c);
  const quick = async () => {
    setBusy(true);
    try {
      await downloadPNG(value, style, c.name);
    } catch {
      onOpen(c);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card-hover group flex flex-col border border-hair bg-card">
      <button type="button" onClick={() => onOpen(c)} className="block bg-paper p-4">
        <div className="mx-auto max-w-[180px] bg-white p-1.5"><QrCanvas value={value} style={style} pixelWidth={300} showError={false} /></div>
      </button>
      <div className="flex flex-1 flex-col gap-2 border-t border-hair px-3 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`mono-label inline-flex items-center gap-1 px-1.5 py-0.5 text-[8.5px] ${dyn ? "bg-[#ff3c00] text-white" : "bg-ink/[0.07] text-ink/70"}`}>
            {dyn ? <Zap className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}{dyn ? "Dynamic" : "Static"}
          </span>
          {dyn && c.active === false && <span className="mono-label inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[8.5px] text-amber-800"><Pause className="h-2.5 w-2.5" />Paused</span>}
          {dyn && <span className="ml-auto text-[12px] text-ink/60"><TickingNumber value={Number(c.scans) || 0} className="font-semibold text-ink" /> scans</span>}
        </div>
        <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">{c.name || "Untitled QR code"}</p>
        <p className="truncate text-[11.5px] text-ink/50">{previewText(c) || "—"}</p>
        <div className="mt-auto flex items-center gap-1 pt-1">
          <button type="button" onClick={() => onOpen(c)} className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-hair text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
          <button type="button" onClick={quick} disabled={busy || !value} className="flex h-8 w-9 items-center justify-center border border-hair text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-40" title="Download PNG"><Download className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onDelete(c)} className="flex h-8 w-9 items-center justify-center border border-hair text-ink/50 hover:border-red-300 hover:text-red-700" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

/**
 * QR library grouped by client folder → project folder.
 * Admin sees every client (filter chips); the portal sees only its own codes.
 */
export default function QrLibrary({ store, scopeKey = "admin", clients = [], onOpen, onNew }) {
  const isAdmin = store.kind === "admin";
  const qc = useQueryClient();
  const key = ["qr-list", scopeKey];
  const q = useQuery({ queryKey: key, queryFn: () => store.listAll(), refetchInterval: 20000 });
  const [client, setClient] = useState("all");
  const [search, setSearch] = useState("");
  const [del, setDel] = useState(null);
  const [newFor, setNewFor] = useState("");
  const codes = q.data?.codes || [];

  const byClient = useMemo(() => {
    const m = {};
    for (const c of codes) m[c.client_id || "internal"] = (m[c.client_id || "internal"] || 0) + 1;
    return m;
  }, [codes]);

  const shown = codes.filter((c) => {
    if (isAdmin && client !== "all" && (c.client_id || "internal") !== client) return false;
    const s = search.trim().toLowerCase();
    return !s || [c.name, c.folder, c.client_name, c.destination, c.url].some((v) => String(v || "").toLowerCase().includes(s));
  });

  // Group: client → folder.
  const groups = useMemo(() => {
    const g = new Map();
    for (const c of shown) {
      const ck = isAdmin ? c.client_id || "internal" : "mine";
      const cname = isAdmin ? (c.client_id ? c.client_name || clients.find((x) => x.id === c.client_id)?.business || "Client" : "Interstellar (internal)") : "";
      if (!g.has(ck)) g.set(ck, { name: cname, clientId: c.client_id || "", folders: new Map() });
      const f = (c.folder || "").trim() || "Unfiled";
      const folders = g.get(ck).folders;
      if (!folders.has(f)) folders.set(f, []);
      folders.get(f).push(c);
    }
    return [...g.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [shown, clients, isAdmin]);

  const totalScans = codes.reduce((a, c) => a + (isDynamic(c) ? Number(c.scans) || 0 : 0), 0);
  const dynCount = codes.filter(isDynamic).length;
  const clientName = (id) => (id === "internal" ? "Interstellar" : clients.find((c) => c.id === id)?.business || codes.find((c) => c.client_id === id)?.client_name || "Client");

  return (
    <div className="space-y-6">
      <div className="grid overflow-hidden border border-hair bg-card sm:grid-cols-3">
        <div className="border-b border-hair px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[34px] font-semibold leading-none tracking-[-0.05em]"><TickingNumber value={codes.length} /></p>
          <p className="mono-label mt-2 text-[9.5px] text-ink/50">QR codes</p>
        </div>
        <div className="border-b border-hair px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[34px] font-semibold leading-none tracking-[-0.05em]"><TickingNumber value={dynCount} /></p>
          <p className="mono-label mt-2 text-[9.5px] text-ink/50">Dynamic &amp; trackable</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[34px] font-semibold leading-none tracking-[-0.05em] text-[#ff3c00]"><TickingNumber value={totalScans} /></p>
          <p className="mono-label mt-2 text-[9.5px] text-ink/50">Total scans</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/40" />
          <input className={`${inputCls} w-full pl-8`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search codes, folders, links…" />
        </div>
        {isAdmin && (
          <select className={inputCls} value={newFor} onChange={(e) => setNewFor(e.target.value)} title="Client for the new code">
            <option value="">New for: Interstellar</option>
            {clients.map((c) => <option key={c.id} value={c.id}>New for: {c.business}</option>)}
          </select>
        )}
        <button type="button" onClick={() => onNew({ clientId: isAdmin ? newFor || (client !== "all" && client !== "internal" ? client : "") : "", folder: "" })} className="flex h-10 items-center gap-2 flame-bg px-4 text-[13px] font-medium text-white">
          <Plus className="h-4 w-4" /> New QR code
        </button>
      </div>

      {isAdmin && Object.keys(byClient).length > 0 && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[["all", "All", codes.length], ...Object.entries(byClient).map(([k, n]) => [k, clientName(k), n]).sort((a, b) => a[1].localeCompare(b[1]))].map(([k, l, n]) => (
            <button key={k} type="button" onClick={() => setClient(k)} className={`flex h-8 shrink-0 items-center gap-1.5 border px-3 text-[12px] ${client === k ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/65 hover:border-ink/40"}`}>
              {l} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}

      {q.isLoading ? (
        <p className="py-16 text-center text-[13px] text-ink/50">Opening the wormhole…</p>
      ) : shown.length === 0 ? (
        <div className="border border-dashed border-ink/25 bg-card px-6 py-16 text-center">
          <QrIcon className="mx-auto h-8 w-8 text-ink/30" />
          <p className="mt-3 text-[14px] font-medium">{codes.length ? "Nothing matches." : "No QR codes yet."}</p>
          <p className="mt-1 text-[12.5px] text-ink/55">Make one for a storefront, a flyer, a menu or a review card. Dynamic codes can be re-pointed after printing.</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.clientId || g.name || "mine"} className="space-y-4">
            {isAdmin && <h2 className="text-[20px] font-semibold tracking-[-0.03em]">{g.name}</h2>}
            {[...g.folders.entries()].sort((a, b) => (a[0] === "Unfiled") - (b[0] === "Unfiled") || a[0].localeCompare(b[0])).map(([folder, list]) => (
              <div key={folder}>
                <div className="mb-2 flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5 text-[#ff3c00]" />
                  <p className="mono-label text-[10px] text-ink/60">{folder}</p>
                  <span className="text-[11px] text-ink/40">{list.length}</span>
                  <button type="button" onClick={() => onNew({ clientId: g.clientId, folder: folder === "Unfiled" ? "" : folder })} className="ml-auto flex items-center gap-1 text-[11.5px] text-ink/50 hover:text-[#ff3c00]"><Plus className="h-3 w-3" /> Add here</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {list.map((c) => <Card key={c.id} c={c} onOpen={onOpen} onDelete={setDel} />)}
                </div>
              </div>
            ))}
          </section>
        ))
      )}

      <ConfirmDialog
        open={!!del}
        title={`Delete "${del?.name || "this code"}"?`}
        body={del && isDynamic(del) && del.short_code ? "This is a dynamic code. Every printed copy will stop working. Open it and pause it instead if you only want to stop it for now." : "Printed static codes keep working: the data is in the image."}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await store.deleteCode(del.id);
          qc.invalidateQueries({ queryKey: key });
        }}
      />
    </div>
  );
}

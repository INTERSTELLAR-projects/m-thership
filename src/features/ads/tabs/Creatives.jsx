import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { exampleSpec, TEMPLATES } from "@/features/social/templates";
import { listPosts } from "@/features/social/lib/socialStore";
import { E, KEYS, inScope, listCreatives, loadSettings } from "../lib/adsApi";
import ScaledAd from "../AdFrame";
import CreativeEditor from "./CreativeEditor";
import { Btn, Empty, Pill, Select, inputCls } from "../ui";

export default function Creatives({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const q = useQuery({ queryKey: KEYS.creatives, queryFn: listCreatives });
  const list = useMemo(() => (q.data || []).filter(inScope(clientId)).filter((c) => c.status !== "archived"), [q.data, clientId]);
  const open = list.find((c) => c.id === openId);

  if (open) return <CreativeEditor creative={open} readOnly={readOnly} onBack={() => setOpenId(null)} />;

  const create = async (data) => {
    const s = await loadSettings();
    const row = await E().AdCreative.create({ platform: "meta", status: "draft", policy_status: "unchecked", cta: "LEARN_MORE", utm: { ...(s.default_utm || {}) }, client_id: clientId, ...data });
    qc.invalidateQueries({ queryKey: KEYS.creatives });
    setNewOpen(false);
    setOpenId(row.id);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="max-w-2xl text-[12.5px] text-ink/60">Ads built from Social Studio posts and templates, exported for Meta placements (1:1, 4:5, 9:16). Copy variants come from Agency Knowledge; every creative is policy-checked before it can go into a campaign.</p>
        {!readOnly && <Btn variant="flame" className="ml-auto" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" />New creative</Btn>}
      </div>
      {q.isLoading ? (
        <p className="py-16 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : !list.length ? (
        <Empty icon={ImagePlus} title="No ad creatives yet" action={!readOnly && <Btn variant="flame" onClick={() => setNewOpen(true)}><Plus className="h-3.5 w-3.5" />New creative</Btn>}>
          Start from a Social Studio post or template. Nothing is sent to Meta from here.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="group border border-hair bg-card text-left transition-colors hover:border-[#ff3c00]/60">
              {c.template ? <ScaledAd template={c.template} spec={c.spec} ratio="4:5" /> : <div className="flex aspect-[4/5] items-center justify-center bg-paper text-[12px] text-ink/40">Copy only — pick a design</div>}
              <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <Pill tone={c.status === "pushed" ? "executed" : "default"}>{c.status}</Pill>
                  <Pill tone={c.policy_status === "unchecked" ? "info" : c.policy_status}>policy {c.policy_status}</Pill>
                </div>
                <p className="mt-1 truncate text-[13px] font-medium group-hover:text-[#ff3c00]">{c.name}</p>
                <p className="truncate text-[11.5px] text-ink/50">{c.headline || "No headline yet"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <NewCreativeDialog open={newOpen} onClose={() => setNewOpen(false)} onCreate={create} />
    </div>
  );
}

function NewCreativeDialog({ open, onClose, onCreate }) {
  const [mode, setMode] = useState("post");
  const [postId, setPostId] = useState("");
  const [tpl, setTpl] = useState(TEMPLATES[0]?.key || "");
  const [busy, setBusy] = useState(false);
  const postsQ = useQuery({ queryKey: ["SocialPost"], queryFn: listPosts, enabled: open });
  const posts = postsQ.data || [];
  const go = async () => {
    setBusy(true);
    try {
      if (mode === "post") {
        const p = posts.find((x) => x.id === postId);
        if (!p) return;
        await onCreate({ name: `Ad — ${p.title || p.spec?.headline || "post"}`.slice(0, 120), source_type: "social_post", social_post_id: p.id, template: p.template, spec: p.spec || {}, primary_text: "" });
      } else {
        const t = TEMPLATES.find((x) => x.key === tpl);
        await onCreate({ name: `Ad — ${t?.label || tpl}`, source_type: "template", template: tpl, spec: exampleSpec(tpl) });
      }
    } catch (e) {
      toast({ title: "Couldn't create", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New ad creative</DialogTitle></DialogHeader>
        <div className="flex border border-hair">
          {[["post", "From a Social post"], ["template", "From a template"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`h-8 flex-1 text-[12px] ${mode === k ? "bg-ink text-white" : "text-ink/60"}`}>{l}</button>
          ))}
        </div>
        {mode === "post" ? (
          postsQ.isLoading ? <p className="text-[12px] text-ink/50">Loading posts…</p> : posts.length ? (
            <select value={postId} onChange={(e) => setPostId(e.target.value)} className={`${inputCls} h-9 py-0`}>
              <option value="">Pick a post</option>
              {posts.map((p) => <option key={p.id} value={p.id}>{p.title || p.spec?.headline || "Untitled"} · {p.status}</option>)}
            </select>
          ) : <p className="text-[12px] text-ink/50">No Social Studio posts yet.</p>
        ) : (
          <Select value={tpl} onChange={setTpl} options={TEMPLATES.map((t) => ({ value: t.key, label: t.label }))} />
        )}
        <p className="text-[11.5px] text-ink/50">The design is copied into the ad, so later edits to the Social post don't change a live ad.</p>
        <DialogFooter>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="flame" disabled={busy || (mode === "post" && !postId)} onClick={go}>Create</Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

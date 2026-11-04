// Admin tool: Chrome Workspace generator (Ops Command deliverable).
// Paste or edit a client's tools as groups, preview the tab strip, then download the bookmarks file
// and the one-click tab-groups extension. Nothing is saved; everything is generated in the browser.
import { useMemo, useState } from "react";
import { Download, Puzzle, Bookmark, RotateCcw, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { TEMPLATE_TEXT, COLOR_HEX, CHROME_COLORS, parseTools, bookmarksHtml, extensionZip, download, slugOf } from "./chromeWorkspace";

export default function ChromeWorkspacePage() {
  const [business, setBusiness] = useState("Interstellar");
  const [text, setText] = useState(TEMPLATE_TEXT);
  const [busy, setBusy] = useState(false);
  const { groups, errors } = useMemo(() => parseTools(text), [text]);
  const tabs = groups.reduce((n, g) => n + g.links.length, 0);
  const name = business.trim() || "Client";

  const getBookmarks = () => download(`${slugOf(name)}-bookmarks.html`, new Blob([bookmarksHtml(name, groups)], { type: "text/html" }));
  const getExtension = async () => {
    setBusy(true);
    try { download(`${slugOf(name)}-workspace-extension.zip`, await extensionZip(name, groups)); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Tools / Chrome Workspace" title="Chrome Workspace" rightText="Ops Command · tab groups + bookmarks" />
      <div className="grid gap-6 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="space-y-4">
          <div className="border border-hair bg-card p-4">
            <label className="mono-label text-[9.5px] text-ink/50" htmlFor="cw-business">Business</label>
            <input id="cw-business" value={business} onChange={(e) => setBusiness(e.target.value)} className="mt-1.5 w-full border border-hair bg-paper px-3 py-2 text-[14px] outline-none focus:border-ink/40" placeholder="Client business name" />
          </div>
          <div className="border border-hair bg-card">
            <div className="flex items-center justify-between border-b border-hair px-4 py-2.5">
              <p className="mono-label text-[9.5px] text-ink/50">Their tools · one group per <code className="font-mono">#&nbsp;Name&nbsp;(color)</code></p>
              <button type="button" onClick={() => setText(TEMPLATE_TEXT)} className="inline-flex items-center gap-1 text-[11.5px] text-ink/55 hover:text-[#ff3c00]"><RotateCcw className="h-3 w-3" /> Interstellar template</button>
            </div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Tools list"
              className="h-[460px] w-full resize-y bg-paper px-4 py-3 font-mono text-[12px] leading-[1.6] text-ink outline-none" />
            <p className="border-t border-hair px-4 py-2 text-[11px] text-ink/50">Each line: <code className="font-mono">Title | https://link</code>. Colors: {CHROME_COLORS.join(", ")}.</p>
          </div>
          {errors.length > 0 && (
            <div className="flex gap-2 border border-[#ff3c00]/40 bg-card px-4 py-3 text-[12px] text-ink/70" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ff3c00]" />
              <ul className="space-y-0.5">{errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="overflow-hidden border border-hair bg-[#202124] text-white shadow-[0_30px_60px_-30px_rgba(26,26,26,.5)]">
            <div className="flex items-center gap-1.5 px-3 pt-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="ml-3 font-mono text-[10px] text-white/45">{name} · Chrome</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
              {groups.map((g) => (
                <span key={g.name} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-[#202124]" style={{ background: COLOR_HEX[g.color] }}>
                  {g.name}<span className="rounded bg-black/15 px-1 font-mono text-[9.5px]">{g.links.length}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 bg-[#35363a] px-3 py-2">
              {groups.map((g) => <span key={g.name} className="inline-flex items-center gap-1.5 text-[11px] text-white/80"><Bookmark className="h-3 w-3" style={{ color: COLOR_HEX[g.color] }} />{g.name}</span>)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px border border-hair bg-hair">
            {[["Tab groups", groups.length], ["Tabs", tabs], ["Bookmark folders", groups.length]].map(([k, v]) => (
              <div key={k} className="bg-card px-4 py-3"><p className="mono-label text-[9px] text-ink/45">{k}</p><p className="mt-1 text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{v}</p></div>
            ))}
          </div>

          <div className="grid gap-px overflow-hidden border border-hair bg-hair sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.name} className="bg-card p-3.5">
                <p className="flex items-center gap-2 text-[13.5px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[g.color] }} />{g.name}</p>
                <ul className="mt-1.5 space-y-0.5">{g.links.map((l) => <li key={l.url} className="truncate text-[11.5px] text-ink/55">{l.title} · <span className="font-mono text-[10.5px] text-ink/40">{new URL(l.url).hostname.replace(/^www\./, "")}</span></li>)}</ul>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={getExtension} disabled={!groups.length || busy} className="flame-bg inline-flex h-11 items-center gap-2 px-5 text-[13.5px] font-semibold text-white disabled:opacity-50">
              <Puzzle className="h-4 w-4" /> {busy ? "Building…" : "Download extension (.zip)"}
            </button>
            <button type="button" onClick={getBookmarks} disabled={!groups.length} className="inline-flex h-11 items-center gap-2 border border-hair bg-card px-5 text-[13.5px] font-medium hover:border-ink/40 disabled:opacity-50">
              <Download className="h-4 w-4" /> Download bookmarks (.html)
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-ink/50">The extension is unpacked (Manifest V3, uses <code className="font-mono">chrome.tabGroups</code>): unzip, open chrome://extensions, turn on Developer mode, Load unpacked. One click opens every named, colored group. The bookmarks file imports at chrome://settings/importData and puts one folder per group on the bookmarks bar. Install steps ship in the zip&apos;s README.</p>
        </section>
      </div>
    </div>
  );
}

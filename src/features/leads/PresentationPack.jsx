// The presentation pack: same structure for every rep, every lead. Brief, what's broken today, walkthrough order,
// talk track, objections, the $1/minute offer and the close to the meeting. Printable.
import { FileText, Loader2, Printer } from "lucide-react";
import { Card, btn, btnFlame } from "./ui";

export default function PresentationPack({ pack, onGenerate, busy, disabled }) {
  if (!pack) {
    return (
      <Card title="Presentation pack" kicker="One structure, every rep">
        <p className="text-[13px] text-ink/65">The pack is generated from the preview: a one-page brief, what's broken today (website, Google profile, operations), the walkthrough order, the talk track, objection handling, the $30 offer and the close to the meeting.</p>
        <button type="button" onClick={onGenerate} disabled={busy || disabled} className={`${btnFlame} mt-3`}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}Generate the pack</button>
      </Card>
    );
  }
  const b = pack.brief || {};
  return (
    <div className="space-y-4" data-testid="presentation-pack">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onGenerate} disabled={busy} className={btn}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Regenerate</button>
        <button type="button" onClick={() => window.print()} className={btn}><Printer className="h-3.5 w-3.5" />Print</button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card title={b.business} kicker="(Brief)">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[12.5px]">
            {[["Industry", b.industry], ["City", b.city], ["Phone", b.phone], ["Website", b.website], ["What they do", b.one_liner], ["Services", (b.services || []).join(", ")]].filter(([, v]) => v).map(([k, v]) => <div key={k} className="contents"><dt className="mono-label pt-0.5 text-[9px] text-ink/45">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}
          </dl>
          {b.google ? <a href={b.google} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-[#ff3c00] hover:underline">Google profile</a> : null}
        </Card>
        <Card title="What's broken today" kicker="Facts only; let them say it">
          {[["Website", pack.broken?.site], ["Google profile", pack.broken?.gbp], ["Operations (ask)", pack.broken?.ops]].map(([k, list]) => (list || []).length ? <div key={k} className="mb-2"><p className="mono-label text-[9.5px] text-[#ff3c00]">{k}</p><ul className="mt-1 space-y-1">{list.map((x) => <li key={x} className="text-[12.5px] leading-relaxed">{x}</li>)}</ul></div> : null)}
        </Card>
      </div>
      <Card title="Opener (whoever answers)" kicker="Goal: they agree the owner or manager will look at the email">
        <p className="border-l-2 border-[#ff3c00] pl-3 text-[14px] leading-relaxed">{pack.opener}</p>
      </Card>
      <Card title="Walkthrough order" kicker="30 minutes">
        <ol className="space-y-2">{(pack.walkthrough || []).map((w, i) => <li key={w.step} className="grid grid-cols-[34px_1fr_auto] gap-2 text-[13px]"><span className="font-mono text-[11px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span><div><b className="font-medium">{w.step}</b><p className="text-ink/65">{w.say}</p></div><span className="font-mono text-[10.5px] text-ink/45">{w.minutes}m</span></li>)}</ol>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Talk track"><ul className="space-y-2">{(pack.talk_track || []).map((t) => <li key={t} className="text-[13px] leading-relaxed">{t}</li>)}</ul></Card>
        <Card title="Objections">
          <ul className="space-y-2.5">{(pack.objections || []).map((o) => <li key={o.q}><p className="text-[13px] font-medium">“{o.q}”</p><p className="text-[12.5px] leading-relaxed text-ink/65">{o.a}</p></li>)}</ul>
        </Card>
      </div>
      <Card title="The offer and the close">
        <p className="text-[13px]"><b className="font-medium">Offer:</b> {pack.offer}</p>
        <p className="mt-2 text-[13px]"><b className="font-medium">Close:</b> {pack.close}</p>
        <ul className="mt-3 flex flex-wrap gap-2">{(pack.rules || []).map((r) => <li key={r} className="border border-hair bg-card px-2 py-1 text-[11.5px] text-ink/65">{r}</li>)}</ul>
      </Card>
    </div>
  );
}

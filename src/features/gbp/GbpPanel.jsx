import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Copy, ExternalLink, Mail, MapPin, MessageSquare, QrCode, Share2, Star } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { timeAgo } from "@/lib/useData";
import { adminStore, portalStore } from "@/features/qr/lib/qrStore";
import { applyPack, brandAccent, brandPack } from "@/features/qr/lib/presets";

// Google Business Profile panel: rating, reviews and the client's review link for every location.
// Data always comes from the `portal` function's `gbp` action (portal users: their own client; admins: client_id),
// so the client portal and the admin client page show exactly the same thing.
//
// Review QR codes are dynamic QR codes saved into the client's QR library (folder "Reviews"),
// through the same store the QR Code Studio uses (portalStore in the portal, adminStore in Møthership).

const REVIEW_FOLDER = "Reviews";
export const gbpKey = (scope) => ["gbp", scope || "me"];

async function copyText(text, what = "Copied") {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error("no clipboard");
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.left = "-9999px";
    document.body.appendChild(t);
    t.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(t);
    }
  }
  toast({ title: what });
}

const textSnippet = (link) => `We'd love your feedback! Leave us a review: ${link}`;
const emailSubject = (biz) => `How did we do${biz ? `, from ${biz}` : ""}?`;
const emailSnippet = (link, biz) =>
  `Hi there,\n\nThank you for choosing ${biz || "us"}! We'd love your feedback. Leave us a review: ${link}\n\nIt only takes a minute and helps our small business a ton.\n\nThank you!`;

function Stars({ value = 0, size = 16 }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / 5) * 100));
  const row = (cls) => (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} style={{ width: size, height: size }} className={cls} />)}
    </span>
  );
  return (
    <span className="relative inline-flex" aria-label={`${value} out of 5 stars`}>
      {row("fill-ink/10 text-ink/10")}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        {row("fill-[#ff6a00] text-[#ff6a00]")}
      </span>
    </span>
  );
}

function IconBtn({ icon: Icon, children, onClick, href, primary, disabled, title }) {
  const cls = `inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] font-medium transition-colors disabled:opacity-50 ${
    primary ? "flame-bg text-white hover:opacity-90" : "border border-hair bg-paper text-ink/75 hover:border-ink/40 hover:text-ink"
  }`;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} title={title}>
        <Icon className="h-3.5 w-3.5" /> {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} title={title}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function Snippet({ icon: Icon, label, text, sendHref, sendLabel }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await copyText(text, "Copied");
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <div className="rounded-md border border-hair bg-paper">
      <div className="flex items-center justify-between gap-2 border-b border-hair px-3 py-2">
        <p className="mono-label flex items-center gap-1.5 text-[9.5px] text-ink/55"><Icon className="h-3.5 w-3.5" /> {label}</p>
        <div className="flex items-center gap-3">
          {sendHref && <a href={sendHref} className="text-[12px] text-ink/55 hover:text-[#ff3c00]">{sendLabel}</a>}
          <button type="button" onClick={copy} className="flex items-center gap-1 text-[12px] font-medium text-ink/70 hover:text-[#ff3c00]">
            {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <p className="whitespace-pre-line px-3 py-2.5 text-[12.5px] leading-relaxed text-ink/75">{text}</p>
    </div>
  );
}

function ReviewLinkBox({ loc, business }) {
  const link = loc.review_url;
  const [done, setDone] = useState(false);
  const copy = async () => {
    await copyText(link, "Copied");
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Review ${loc.business_name || business}`, text: "We'd love your feedback! Leave us a review:", url: link });
      } catch {
        /* dismissed */
      }
      return;
    }
    await copyText(link, "Link copied. Paste it anywhere to share.");
  };
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <div className="h-1 flame-bg" />
      <div className="p-4 md:p-5">
        <p className="mono-label text-[9.5px] text-ink/50">Your review link</p>
        <p className="mt-1 text-[13px] text-ink/60">Send this to happy customers. It opens Google straight to the review box.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 border border-hair bg-paper px-3 py-2 font-mono text-[12px] text-ink/80 outline-none focus:border-[#ff3c00]"
            aria-label="Review link"
          />
          <button type="button" onClick={copy} className="inline-flex h-10 items-center justify-center gap-1.5 flame-bg px-5 text-[13px] font-semibold text-white hover:opacity-90">
            {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {done ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <IconBtn icon={ExternalLink} href={link}>Open</IconBtn>
          <IconBtn icon={Share2} onClick={share}>Share</IconBtn>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Snippet icon={MessageSquare} label="Text message" text={textSnippet(link)} sendHref={`sms:?&body=${encodeURIComponent(textSnippet(link))}`} sendLabel="Text it" />
          <Snippet
            icon={Mail}
            label="Email"
            text={emailSnippet(link, loc.business_name || business)}
            sendHref={`mailto:?subject=${encodeURIComponent(emailSubject(loc.business_name || business))}&body=${encodeURIComponent(emailSnippet(link, loc.business_name || business))}`}
            sendLabel="Email it"
          />
        </div>
      </div>
    </section>
  );
}

function QrCard({ loc, onMake, busy }) {
  const qr = loc.qr;
  return (
    <section className="rounded-md border border-hair bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center flame-bg text-white"><QrCode className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-[-0.02em]">Review QR code</p>
          <p className="text-[12px] text-ink/55">
            {qr ? "Print it on receipts, counters and cards. Every scan is counted." : "A trackable, on-brand QR code that opens your review link. Print it anywhere."}
          </p>
        </div>
      </div>
      {qr && (
        <div className="mt-3 grid grid-cols-2 border border-hair">
          <div className="border-r border-hair px-3 py-2.5">
            <p className="text-[24px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{qr.scans || 0}</p>
            <p className="mono-label mt-1.5 text-[9px] text-ink/50">Scans</p>
          </div>
          <div className="px-3 py-2.5">
            <p className="truncate text-[13px] font-medium">{qr.last_scan_at ? timeAgo(qr.last_scan_at) : "Not yet"}</p>
            <p className="mono-label mt-1.5 text-[9px] text-ink/50">Last scan</p>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onMake}
        disabled={busy}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#ff3c00] disabled:opacity-60"
      >
        <QrCode className="h-4 w-4" /> {busy ? "Making your code…" : qr ? "Open review QR code" : "Make a review QR code"}
      </button>
    </section>
  );
}

function ReviewsList({ reviews }) {
  if (!reviews?.length) {
    return <p className="px-4 py-8 text-center text-[13px] text-ink/55">Your newest 4 and 5 star Google reviews will show up here.</p>;
  }
  return (
    <ul className="divide-y divide-hair">
      {reviews.map((r, i) => (
        <li key={`${r.author}-${r.time || i}`} className="px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-[12px] font-semibold text-ink/70">{(r.author || "G")[0]}</span>
            <span className="text-[13px] font-medium">{r.author}</span>
            <Stars value={r.rating} size={12} />
            <span className="ml-auto whitespace-nowrap text-[11px] text-ink/45">{r.relative || (r.time ? timeAgo(r.time) : "")}</span>
          </div>
          {r.text && <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-ink/70">{r.text}</p>}
        </li>
      ))}
    </ul>
  );
}

function Connecting() {
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <div className="h-1 flame-bg" />
      <div className="mx-auto max-w-md px-6 py-14 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center flame-bg text-white"><MapPin className="h-5 w-5" /></span>
        <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.03em]">We&apos;re connecting your Google profile</h3>
        <p className="mt-2 text-[13.5px] text-ink/60">
          Once your Google Business Profile is linked, your rating, newest reviews and a one-click review link will live right here.
        </p>
      </div>
    </section>
  );
}

// The panel itself. `fetchGbp` loads the `gbp` payload; `store` is the QR store; `onOpenQr(code)` jumps to the QR editor.
export default function GbpPanel({ scope, fetchGbp, store, clientId, clientName, onOpenQr, header = true }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: gbpKey(scope), queryFn: fetchGbp, retry: false, staleTime: 5 * 60 * 1000 });
  const [pickedId, setPickedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const data = q.data;
  const locations = useMemo(() => data?.locations || [], [data]);
  const loc = locations.find((l) => l.id === pickedId) || locations[0];

  const makeQr = async () => {
    if (!loc || busy) return;
    if (loc.qr?.id) {
      onOpenQr(loc.qr);
      return;
    }
    setBusy(true);
    try {
      // Re-check right before creating so a second click or another tab never makes a duplicate.
      const fresh = await fetchGbp().catch(() => null);
      const existing = fresh?.locations?.find((l) => l.id === loc.id)?.qr;
      if (existing?.id) {
        qc.setQueryData(gbpKey(scope), fresh);
        onOpenQr(existing);
        return;
      }
      const brand = await store.brand(clientId).catch(() => null);
      const pack = brandPack(brand);
      const style = applyPack({}, {
        ...(pack?.style || {}),
        frame_style: "banner-bottom",
        frame_text: "LEAVE US A REVIEW",
        frame_color: brandAccent(brand) ? pack.style.frame_color : "#ff3c00",
      });
      const locName = locations.length > 1 ? loc.label || loc.name : loc.business_name || loc.name;
      const code = await store.saveCode(null, {
        name: `Google review – ${locName}`,
        folder: REVIEW_FOLDER,
        mode: "dynamic",
        content_type: "link",
        destination: loc.review_url,
        style,
        ...(clientId ? { client_id: clientId, client_name: clientName || "" } : {}),
      });
      toast({ title: "Review QR code created", description: "Opening it so you can download it." });
      qc.invalidateQueries({ queryKey: gbpKey(scope) });
      qc.invalidateQueries({ queryKey: ["qr-list"] });
      if (code?.id) onOpenQr(code);
    } catch (e) {
      toast({ title: "Couldn't make the QR code", description: e?.response?.data?.error || e?.message || "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const title = header && (
    <div>
      <p className="label-cross">(Google Business Profile)</p>
      <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">Google Business</h2>
      <p className="mt-1 max-w-2xl text-[14px] text-ink/60">Your Google rating, newest reviews and the fastest way to ask customers for more.</p>
    </div>
  );

  if (q.isLoading) return <div className="space-y-6">{title}<p className="py-16 text-center text-[13px] text-ink/50">Loading your Google profile…</p></div>;
  if (q.isError) {
    return (
      <div className="space-y-6">
        {title}
        <section className="rounded-md border border-hair bg-card px-6 py-12 text-center">
          <p className="text-[13.5px] text-ink/60">We couldn&apos;t load your Google profile right now.</p>
          <button type="button" onClick={() => q.refetch()} className="mt-3 text-[13px] font-medium text-[#ff3c00] hover:underline">Try again</button>
        </section>
      </div>
    );
  }
  if (!data?.connected || !loc) return <div className="space-y-6">{title}<Connecting /></div>;

  return (
    <div className="space-y-6">
      {title}
      {locations.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Locations">
          {locations.map((l) => {
            const on = l.id === loc.id;
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setPickedId(l.id)}
                className={`inline-flex h-9 items-center gap-1.5 border px-3.5 text-[13px] font-medium transition-colors ${on ? "border-transparent flame-bg text-white" : "border-hair bg-card text-ink/65 hover:border-ink/40 hover:text-ink"}`}
              >
                <MapPin className="h-3.5 w-3.5" /> {l.label || l.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        <div className="space-y-5">
          <section className="band-dark grain rounded-md p-5">
            <p className="mono-label text-[10px] text-white/50">{loc.business_name}</p>
            {loc.rating != null ? (
              <>
                <div className="mt-3 flex items-end gap-3">
                  <p className="flame-text text-[64px] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">{Number(loc.rating).toFixed(1)}</p>
                  <div className="pb-1">
                    <Stars value={loc.rating} size={18} />
                    <p className="mt-1 text-[12.5px] text-white/65">{loc.total != null ? `${Number(loc.total).toLocaleString()} Google reviews` : "Google reviews"}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-3 text-[15px] text-white/70">Your rating will appear after the first sync.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {loc.maps_url && (
                <a href={loc.maps_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 border border-white/25 px-3.5 text-[12.5px] font-medium text-white hover:bg-white hover:text-ink">
                  <MapPin className="h-3.5 w-3.5" /> Open on Google Maps
                </a>
              )}
            </div>
            <p className="mt-4 text-[11px] text-white/45">{loc.cached_at ? `Updated ${timeAgo(loc.cached_at)}` : "Waiting for first sync"} · refreshes daily</p>
          </section>
          <QrCard loc={loc} onMake={makeQr} busy={busy} />
        </div>
        <div className="space-y-5">
          <ReviewLinkBox loc={loc} business={data.business} />
          <section className="rounded-md border border-hair bg-card">
            <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
              <div>
                <p className="mono-label text-[9.5px] text-ink/50">What customers say</p>
                <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Recent reviews</h3>
              </div>
              {loc.maps_url && <a href={loc.maps_url} target="_blank" rel="noreferrer" className="text-[12px] text-ink/55 hover:text-[#ff3c00]">See all on Google →</a>}
            </header>
            <ReviewsList reviews={loc.reviews} />
          </section>
        </div>
      </div>
    </div>
  );
}

// Client portal tab.
export function PortalGbp({ call, previewId, onOpenQr }) {
  const store = useMemo(() => portalStore(call), [call]);
  return <GbpPanel scope={`portal:${previewId || "me"}`} fetchGbp={() => call("gbp")} store={store} onOpenQr={onOpenQr} />;
}

// Admin client page tab (src/pages/ClientCockpit.jsx). Same payload, via the portal function's admin preview path.
export function ClientGbpTab({ client }) {
  const navigate = useNavigate();
  const fetchGbp = async () => (await base44.functions.invoke("portal", { action: "gbp", client_id: client.id })).data;
  return (
    <GbpPanel
      scope={`admin:${client.id}`}
      fetchGbp={fetchGbp}
      store={adminStore}
      clientId={client.id}
      clientName={client.business}
      onOpenQr={(code) => navigate(`/qr/${code.id}`)}
      header={false}
    />
  );
}

// Small quick-copy card for the portal home. Shares the `gbp` query cache with the tab; renders nothing until connected.
export function ReviewLinkQuick({ call, previewId, go }) {
  const q = useQuery({ queryKey: gbpKey(`portal:${previewId || "me"}`), queryFn: () => call("gbp"), retry: false, staleTime: 5 * 60 * 1000 });
  const locs = (q.data?.locations || []).filter((l) => l.review_url);
  if (!q.data?.connected || !locs.length) return null;
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <div className="h-1 flame-bg" />
      <header className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Get more reviews</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Your review link</h3>
        </div>
        <button type="button" onClick={() => go("gbp")} className="text-[12px] text-ink/55 hover:text-[#ff3c00]">Google Business →</button>
      </header>
      <ul className="divide-y divide-hair">
        {locs.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{locs.length > 1 ? l.label || l.name : l.business_name}</span>
              {l.rating != null && <span className="flex items-center gap-1.5 text-[11.5px] text-ink/55"><Stars value={l.rating} size={11} /> {Number(l.rating).toFixed(1)}{l.total != null ? ` · ${l.total} reviews` : ""}</span>}
            </span>
            <button type="button" onClick={() => copyText(l.review_url, "Copied")} className="inline-flex h-8 items-center gap-1.5 flame-bg px-3 text-[12px] font-medium text-white hover:opacity-90">
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Portal > Studios > Email Studio (HyperCare+, switched on). Locked plans and previews never reach this component:
// PortalApp shows the Studio preview page instead (PortalStudios.jsx, key "email").
// Done for you, or do it yourself: every screen has "Want us to do it? Send a request".
import { useState } from "react";
import { Loader2, Mail, Users, Filter, Zap, ClipboardList, Settings2, FlaskConical } from "lucide-react";
import { useEmailStudio, errMsg } from "./api";
import CampaignsTab from "./CampaignsTab";
import ContactsTab from "./ContactsTab";
import SegmentsTab from "./SegmentsTab";
import AutomationsTab from "./AutomationsTab";
import FormsTab from "./FormsTab";
import SettingsTab from "./SettingsTab";
import RequestHelpButton from "@/features/studios/RequestHelpButton";
import { Notice } from "./ui";

const TABS = [["campaigns", "Campaigns", Mail], ["contacts", "Contacts", Users], ["segments", "Segments", Filter], ["automations", "Automations", Zap], ["forms", "Sign-up forms", ClipboardList], ["settings", "Settings", Settings2]];
const HELP = {
  campaigns: "e.g. Write and send our holiday promo to the Customers list next Tuesday at 9am.",
  contacts: "e.g. Import the attached customer export from Square and tag them 2025-customers.",
  segments: "e.g. Make a segment of customers who haven't booked in a year.",
  automations: "e.g. Set up a review request that goes out the day after every finished job.",
  forms: "e.g. Add a newsletter sign-up form to our website footer.",
  settings: "e.g. Use our new logo and colors in every email.",
};

export default function PortalEmailStudio({ scopeId, business, preview }) {
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem("email-studio.tab") || "campaigns"; } catch { return "campaigns"; } });
  const go = (k) => { setTab(k); try { sessionStorage.setItem("email-studio.tab", k); } catch { /* storage blocked */ } };
  const { call, overview, refresh } = useEmailStudio(scopeId);
  const d = overview.data;
  return (
    <div className="space-y-6" data-portal-email-studio>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-cross">(Email marketing)</p>
          <h1 className="mt-2 text-[32px] font-semibold leading-[1.02] tracking-[-0.045em] md:text-[44px]">Email Studio <span className="text-[#ff3c00]">/ in your brand.</span></h1>
          <p className="mt-2 max-w-2xl text-[14.5px] text-ink/60">Campaigns, automations and sign-up forms for {business || "your business"}, sent from your own domain. Do it yourself here, or hand it to us.</p>
        </div>
        <RequestHelpButton studio="email" studioLabel="Email Studio" scopeId={scopeId} preview={preview} context={`Email Studio > ${TABS.find((t) => t[0] === tab)?.[1]}`} placeholder={HELP[tab]} />
      </div>

      {overview.isLoading ? (
        <p className="py-20 text-center text-ink/45"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></p>
      ) : overview.isError ? (
        <Notice tone="error">{errMsg(overview.error)}</Notice>
      ) : (
        <>
          {d.dry_run && <Notice tone="test"><span className="inline-flex items-center gap-1.5 font-semibold"><FlaskConical className="h-4 w-4" /> Test mode.</span> Everything works end to end, but no email is actually delivered.</Notice>}
          {!d.dry_run && !d.readiness?.ready && (
            <Notice tone={d.readiness?.code === "no_address" ? "warn" : "info"} action={d.readiness?.code === "no_address" ? <button type="button" onClick={() => go("settings")} className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">Add address</button> : null}>
              {d.readiness?.reason} {d.readiness?.code !== "no_address" && "You can build lists, campaigns and automations now."}
            </Notice>
          )}
          {d.dry_run && d.readiness?.code === "no_address" && <Notice tone="warn" action={<button type="button" onClick={() => go("settings")} className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-white">Add address</button>}>{d.readiness.reason}</Notice>}
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Email Studio sections">
            {TABS.map(([k, l, I]) => (
              <button key={k} type="button" onClick={() => go(k)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold transition-colors ${tab === k ? "bg-ink text-white" : "bg-white text-ink/60 ring-1 ring-hair hover:text-ink"}`}>
                <I className={`h-4 w-4 ${tab === k ? "text-[#ff6a00]" : ""}`} /> {l}
                {k === "contacts" && d.counts?.total ? <span className={`rounded-full px-1.5 text-[11px] ${tab === k ? "bg-white/15" : "bg-ink/[0.06]"}`}>{d.counts.total.toLocaleString("en-US")}</span> : null}
                {k === "automations" && d.automations?.some((a) => a.status === "active") ? <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> : null}
              </button>
            ))}
          </nav>
          <div key={tab} className="page-enter">
            {tab === "campaigns" && <CampaignsTab data={d} call={call} refresh={refresh} go={go} />}
            {tab === "contacts" && <ContactsTab data={d} call={call} refresh={refresh} />}
            {tab === "segments" && <SegmentsTab data={d} call={call} refresh={refresh} />}
            {tab === "automations" && <AutomationsTab data={d} call={call} refresh={refresh} />}
            {tab === "forms" && <FormsTab data={d} call={call} refresh={refresh} />}
            {tab === "settings" && <SettingsTab data={d} call={call} refresh={refresh} />}
          </div>
        </>
      )}
    </div>
  );
}

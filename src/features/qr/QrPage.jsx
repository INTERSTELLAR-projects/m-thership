import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import QrLibrary from "./QrLibrary";
import QrEditor from "./QrEditor";
import { adminStore } from "./lib/qrStore";
import CodesAppPanel from "@/features/codesApp/CodesAppPanel";

const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();
  return s ? `?${s}` : "";
};

function useClients() {
  const [clients, setClients] = useState([]);
  useEffect(() => {
    adminStore.listClients().then(setClients).catch(() => setClients([]));
  }, []);
  return clients;
}

// Two tabs on one page: the QR library, and the Interstellar Codes (interstellarcodes.com) growth + SEO panel.
function QrTabs({ codesApp }) {
  const tab = (on) => `rounded-sm px-3 py-1.5 text-[12.5px] transition-colors ${on ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`;
  return (
    <nav aria-label="QR page sections" className="px-5 pt-5 md:px-8">
      <div className="inline-flex rounded-md border border-hair bg-card p-0.5" role="tablist">
        <Link to="/qr" role="tab" aria-selected={!codesApp} className={tab(!codesApp)}>QR codes</Link>
        <Link to="/qr?tab=codes-app" role="tab" aria-selected={codesApp} className={tab(codesApp)} data-testid="qr-codes-app-tab">Interstellar Codes app</Link>
      </div>
    </nav>
  );
}

// /qr: every client's QR codes, organized by client folder.
export default function QrPage() {
  const navigate = useNavigate();
  const clients = useClients();
  const [params] = useSearchParams();
  // /qr?tab=codes-app: the Interstellar Codes (interstellarcodes.com) growth + SEO panel.
  if (params.get("tab") === "codes-app") {
    return (
      <div className="min-h-full">
        <PageHeader breadcrumb="Studio / Interstellar Codes" title="Interstellar /Codes" rightText="interstellarcodes.com">
          <Link to="/qr" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/70 hover:text-[#ff3c00]">Back to QR codes</Link>
        </PageHeader>
        <QrTabs codesApp />
        <CodesAppPanel />
      </div>
    );
  }
  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Studio / QR Codes" rightText="Interstellar Codes">
        <Link to="/qr?tab=codes-app" className="inline-flex items-center gap-1.5 text-[12.5px] text-ink/70 hover:text-[#ff3c00]" data-testid="qr-codes-app-link">Interstellar Codes app<ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </PageHeader>
      <QrTabs codesApp={false} />
      <div className="px-5 py-6 md:px-8">
        <p className="mb-5 max-w-3xl text-sm text-muted-foreground">
          Branded QR codes for Interstellar and every client. Dynamic codes print a permanent Møthership short link you can re-point anytime, with scan counts.
          Codes in a client&apos;s folder show up in that client&apos;s portal, where they can make their own.
        </p>
        <QrLibrary
          store={adminStore}
          scopeKey="admin"
          clients={clients}
          onOpen={(c) => navigate(`/qr/${c.id}`)}
          onNew={({ clientId, folder }) => navigate(`/qr/new${qs({ client: clientId, folder })}`)}
        />
      </div>
    </div>
  );
}

// /qr/new?client=&folder=   and   /qr/:id
export function QrEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const clients = useClients();
  const isNew = !id || id === "new";
  return (
    <QrEditor
      store={adminStore}
      id={isNew ? null : id}
      start={{ clientId: params.get("client") || "", folder: params.get("folder") || "" }}
      clients={clients}
      onExit={() => navigate("/qr")}
      onCreated={(r) => navigate(`/qr/${r.id}`, { replace: true })}
    />
  );
}

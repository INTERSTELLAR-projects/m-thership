import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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

// /qr: every client's QR codes, organized by client folder.
export default function QrPage() {
  const navigate = useNavigate();
  const clients = useClients();
  const [params] = useSearchParams();
  // /qr?tab=codes-app: the Interstellar Codes (interstellarcodes.com) growth + SEO panel.
  if (params.get("tab") === "codes-app") {
    return (
      <div className="min-h-full">
        <PageHeader breadcrumb="More / Interstellar Codes" title="Interstellar /Codes" rightText="interstellarcodes.com" />
        <CodesAppPanel />
      </div>
    );
  }
  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Studio / QR Codes" rightText="Wørmhole" />
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

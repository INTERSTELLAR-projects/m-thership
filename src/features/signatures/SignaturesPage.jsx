import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import SignatureLibrary from "@/features/signatures/SignatureLibrary";
import { adminStore } from "@/features/signatures/lib/signatureStore";

const qs = (o) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export default function SignaturesPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [clients, setClients] = useState([]);
  useEffect(() => {
    adminStore.listClients().then(setClients).catch(() => setClients([]));
  }, []);

  return (
    <div className="min-h-full">
      <PageHeader breadcrumb="Tools / Email Signatures" rightText="Føøtprint" />
      <div className="px-5 py-6 md:px-8">
        <p className="text-sm text-muted-foreground mb-5">
          Animated email signatures for Interstellar and every client. Put signatures and templates in a client&apos;s folder and they show up in that
          client&apos;s portal, where their team can make their own from the same default.
        </p>
        <SignatureLibrary
          store={adminStore}
          clients={clients}
          initialTab={params.get("tab") === "templates" ? "templates" : "signatures"}
          onOpen={(s) => navigate(`/signatures/${s.id}`)}
          onNew={({ templateId, clientId, folder }) => navigate(`/signatures/new${qs({ template: templateId, client: clientId, folder })}`)}
          onOpenTemplate={(t) => navigate(`/signatures/templates/${t.id}`)}
          onNewTemplate={({ clientId, folder }) => navigate(`/signatures/templates/new${qs({ client: clientId, folder })}`)}
        />
      </div>
    </div>
  );
}

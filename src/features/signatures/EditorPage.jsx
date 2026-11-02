import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SignatureEditor from "@/features/signatures/SignatureEditor";
import { adminStore } from "@/features/signatures/lib/signatureStore";

// Admin routes:
//   /signatures/new?template=&client=&folder=   new signature (default template unless one is given)
//   /signatures/:id                             edit a signature
//   /signatures/templates/new?from=&client=     new template
//   /signatures/templates/:id                   edit a template
export default function EditorPage({ mode = "signature" }) {
  const { id: routeId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = routeId && routeId !== "new" ? routeId : null;
  const [clients, setClients] = useState([]);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    adminStore.listClients().then(setClients).catch(() => setClients([]));
    Promise.all([adminStore.listSignatures(), adminStore.listTemplates()])
      .then(([s, t]) => setFolders([...new Set([...s, ...t].map((x) => x.folder).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  const back = () => navigate(mode === "template" ? "/signatures?tab=templates" : "/signatures");

  return (
    <SignatureEditor
      key={mode}
      store={adminStore}
      mode={mode}
      id={id}
      start={{ templateId: params.get("template") || params.get("from") || null, clientId: params.get("client") || "", folder: params.get("folder") || "" }}
      clients={clients}
      folders={folders}
      onExit={back}
      onCreated={(r) => navigate(mode === "template" ? `/signatures/templates/${r.id}` : `/signatures/${r.id}`, { replace: true })}
    />
  );
}

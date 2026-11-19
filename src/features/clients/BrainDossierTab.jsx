// Client profile · Brain & brand · Dossier. What used to sit under the old "Constellations" tab, minus the 3D view:
// the client-app Brain card and the dossier editor. It also keeps the stored health score in step (lists and the
// dashboard read it), as the old tab did.
import { useEffect } from "react";
import { useConstellation } from "@/features/constellations/useConstellation";
import DossierEditor from "@/features/constellations/DossierEditor";
import ClientBrainCard from "@/features/constellations/ClientBrainCard";

export default function BrainDossierTab({ client }) {
  const con = useConstellation(client);
  useEffect(() => {
    if (con.loading || con.health == null) return undefined;
    const t = setTimeout(() => { con.persistScore().catch(() => {}); }, 1500);
    return () => clearTimeout(t);
  }, [con.loading, con.health]); // eslint-disable-line react-hooks/exhaustive-deps
  if (con.loading) return <div className="h-40 animate-pulse rounded-md border border-hair bg-ink/[0.03]" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink/60">
        <span>Business health <b className="text-ink">{con.health ?? "—"}</b></span>
        {con.constraint ? <span>· Biggest constraint: <b className="text-ink">{con.constraint.name}</b></span> : null}
      </div>
      <ClientBrainCard client={client} stats={con.d?.client_brain} />
      <DossierEditor client={client} con={con} />
    </div>
  );
}

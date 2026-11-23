// Non-admin logins: a sales rep gets the sales side; everyone else (clients and leads) gets their portal.
// The server decides (sales-team "me" matches the login to an active SalesRep row); the browser can't promote itself.
import { useQuery } from "@tanstack/react-query";
import PortalApp from "@/features/portal/PortalApp";
import SalesApp from "./SalesApp";
import { sales } from "./api";

export default function StaffGate() {
  const q = useQuery({ queryKey: ["sales-team", "me-gate"], queryFn: () => sales("me"), retry: 1, staleTime: 5 * 60000 });
  if (q.isLoading) return <div className="fixed inset-0 flex items-center justify-center bg-canvas"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-hair border-t-[#ff3c00]" aria-label="Loading" /></div>;
  if (q.data?.kind === "sales") return <SalesApp me={q.data} />;
  return <PortalApp />;
}

import { useState, useEffect } from "react";
import { Search, Clock, AlertCircle, CheckCircle, FileText, Loader2, ChevronDown, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";

export default function Requests() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("all");

  useEffect(() => {
    base44.entities.CRMClient.list("-created_date", 200).then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  // Flatten all requests from all clients, attaching client info
  const allRequests = clients.flatMap((client) =>
    (client.requests || []).map((req) => ({
      ...req,
      clientName: client.business,
      clientId: client.id,
      clientEmail: client.emails?.[0] || "",
    }))
  );

  const filtered = allRequests.filter((req) => {
    const matchSearch =
      !search ||
      req.title?.toLowerCase().includes(search.toLowerCase()) ||
      req.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchClient = selectedClientId === "all" || req.clientId === selectedClientId;
    return matchSearch && matchClient;
  });

  const pending = filtered.filter((r) => r.status === "Pending");
  const inProgress = filtered.filter((r) => r.status === "In Progress");
  const completed = filtered.filter((r) => r.status === "Completed");

  const clientsWithRequests = clients.filter((c) => (c.requests || []).length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader breadcrumb="Command / Requests" rightText="All Client Requests" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command / Requests" rightText="All Client Requests" />
      <div className="px-8 py-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <Input
              placeholder="Search requests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-9"
            />
          </div>

          {/* Client filter */}
          <div className="relative">
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="appearance-none bg-card border border-ink/[0.13] rounded-lg px-3 pr-8 py-2 text-sm text-ink/70 outline-none h-9 cursor-pointer hover:border-ink/[0.12] transition-all"
            >
              <option value="all">All Clients</option>
              {clientsWithRequests.map((c) => (
                <option key={c.id} value={c.id}>{c.business}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.48] pointer-events-none" />
          </div>

          {/* Summary counts */}
          <div className="flex gap-3 ml-auto">
            <StatBadge label="Pending" count={pending.length} color="orange" />
            <StatBadge label="In Progress" count={inProgress.length} color="blue" />
            <StatBadge label="Completed" count={completed.length} color="green" />
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-card border border-ink/[0.13] mb-6">
            <TabsTrigger value="pending" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58]">
              Pending ({pending.length})
            </TabsTrigger>
            <TabsTrigger value="inprogress" className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-600 text-ink/[0.58]">
              In Progress ({inProgress.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-green-500/15 data-[state=active]:text-green-600 text-ink/[0.58]">
              Completed ({completed.length})
            </TabsTrigger>
            <TabsTrigger value="byclient" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58]">
              By Client
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <RequestList requests={pending} icon={Clock} emptyText="No pending requests." />
          </TabsContent>

          <TabsContent value="inprogress">
            <RequestList requests={inProgress} icon={AlertCircle} emptyText="No requests in progress." />
          </TabsContent>

          <TabsContent value="completed">
            <RequestList requests={completed} icon={CheckCircle} emptyText="No completed requests yet." />
          </TabsContent>

          <TabsContent value="byclient">
            <ByClientView clients={clients} search={search} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RequestList({ requests, emptyText }) {
  if (requests.length === 0) {
    return (
      <div className="game-panel p-10 text-center">
        <FileText className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
        <p className="text-ink/[0.48] text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((req, i) => (
        <RequestCard key={`${req.clientId}-${req.id ?? i}`} req={req} showClient />
      ))}
    </div>
  );
}

function RequestCard({ req, showClient }) {
  const statusColors = {
    "Pending": "bg-orange-500/10 text-orange-600",
    "In Progress": "bg-blue-500/10 text-blue-600",
    "Completed": "bg-green-500/10 text-green-600",
  };

  return (
    <div className="game-panel p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-ink/85 text-sm font-medium">{req.title}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColors[req.status] || "bg-ink/5 text-ink/[0.58]"}`}>
            {req.status || "New"}
          </span>
        </div>
        {req.formType && <p className="text-ink/[0.48] text-xs mt-1">{req.formType}</p>}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {showClient && req.clientName && (
            <span className="flex items-center gap-1 text-orange-500/60 text-[10px] font-medium">
              <User className="w-3 h-3" />{req.clientName}
            </span>
          )}
          {req.submittedDate && (
            <span className="text-ink/[0.43] text-[10px]">Submitted {req.submittedDate}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ByClientView({ clients, search }) {
  const clientsWithRequests = clients.filter((c) => (c.requests || []).length > 0);

  const filtered = clientsWithRequests.filter(
    (c) => !search || c.business?.toLowerCase().includes(search.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="game-panel p-10 text-center">
        <User className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
        <p className="text-ink/[0.48] text-sm">No clients have submitted requests yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filtered.map((client) => (
        <div key={client.id} className="game-panel p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 text-xs font-display font-extrabold">
              {client.business?.charAt(0)}
            </div>
            <div>
              <h3 className="text-ink font-bold text-sm">{client.business}</h3>
              <p className="text-ink/[0.48] text-xs">{(client.requests || []).length} request{(client.requests || []).length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="space-y-2">
            {(client.requests || []).map((req, i) => (
              <RequestCard key={`${client.id}-${req.id ?? i}`} req={{ ...req, clientName: client.business, clientId: client.id }} showClient={false} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBadge({ label, count, color }) {
  const colors = {
    orange: "text-orange-600 bg-orange-500/10 border-orange-500/20",
    blue: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    green: "text-green-600 bg-green-500/10 border-green-500/20",
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${colors[color]}`}>
      <span>{count}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}
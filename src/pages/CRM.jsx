import { useState } from "react";
import { Search, Plus, Phone, Mail, Globe, Building, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PageHeader from "../components/PageHeader";

const clients = [
  { id: 1, business: "Redline Visuals", contact: "Jake Morrison", phone: "(503) 555-0112", email: "jake@redlinevisuals.com", website: "redlinevisuals.com", services: ["Ørbit SEO", "GBP Badge"], monthlyPayment: 219, status: "Active" },
  { id: 2, business: "CNG & Rein", contact: "Carlos Garcia", phone: "(503) 555-0198", email: "carlos@cngrein.com", website: "cngrein.com", services: ["Ørbit SEO"], monthlyPayment: 500, status: "Active" },
  { id: 3, business: "Mow Masters", contact: "Tyler Reed", phone: "(503) 555-0245", email: "tyler@mowmasters.com", website: "mowmasters.com", services: ["Ørbit SEO", "GBP Badge"], monthlyPayment: 520, status: "Active" },
  { id: 4, business: "Muscle Mentor", contact: "Sarah Chen", phone: "(971) 555-0331", email: "sarah@musclementor.com", website: "musclementor.com", services: ["Ørbit SEO"], monthlyPayment: 199, status: "Active" },
  { id: 5, business: "NW Tree Service", contact: "Mike Thompson", phone: "(503) 555-0478", email: "mike@nwtreeservice.com", website: "nwtreeservice.com", services: ["Ørbit SEO", "GBP Badge", "Ops Management"], monthlyPayment: 1019, status: "Active" },
  { id: 6, business: "Arcane Ink", contact: "Liam Brooks", phone: "(971) 555-0567", email: "liam@arcaneink.com", website: "arcaneink.com", services: ["Ørbit SEO", "GBP Badge"], monthlyPayment: 319, status: "Active" },
  { id: 7, business: "Uplift Aviation", contact: "Alex Wright", phone: "(503) 555-0623", email: "alex@upliftaviation.com", website: "upliftaviation.com", services: ["Web Øps"], monthlyPayment: 250, status: "Active" },
  { id: 8, business: "Maybe Not Safe", contact: "Jordan Lee", phone: "(971) 555-0789", email: "jordan@maybenotsafe.com", website: "maybenotsafe.com", services: ["Web Øps"], monthlyPayment: 125, status: "Active" },
  { id: 9, business: "SMPL Social", contact: "Diana Foster", phone: "(503) 555-0890", email: "diana@smplsocial.com", website: "smplsocial.com", services: ["Software Maintenance"], monthlyPayment: 325, status: "Active" },
];

const statusFilters = ["All", "Active", "Inactive", "Lead"];

export default function CRM() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedClient, setSelectedClient] = useState(null);

  const filtered = clients.filter((c) => {
    const matchSearch = c.business.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClient(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / CRM" rightText="Customer Management" />

      <div className="px-8 py-6 space-y-5">
        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9"
            />
          </div>
          <div className="flex gap-1.5">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === f
                    ? "bg-orange-500/15 text-orange-500 border border-orange-500/20"
                    : "text-white/30 hover:text-white/50 border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </div>

        {/* Client List */}
        <div className="space-y-2">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="w-full bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-5 group hover:border-orange-500/15 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/5 flex items-center justify-center text-orange-500/50 text-sm font-bold border border-orange-500/10">
                {client.business.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white/90 text-sm font-medium">{client.business}</span>
                  <span className="text-green-400/50 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-green-400/5 rounded">
                    {client.status}
                  </span>
                </div>
                <p className="text-white/30 text-xs">{client.contact} · {client.email}</p>
              </div>
              <div className="text-right mr-2">
                <p className="text-orange-500 text-sm font-bold">${client.monthlyPayment}/mo</p>
                <p className="text-white/15 text-xs">{client.services.length} services</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientDetail({ client, onBack }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-white/5">
        <button onClick={onBack} className="text-white/30 hover:text-white/60 text-sm transition-colors">&larr; Back</button>
        <span className="text-white/15">/</span>
        <span className="text-white font-bold text-sm tracking-wide">{client.business}</span>
      </div>

      <div className="px-8 py-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-card border border-white/[0.06] mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">Overview</TabsTrigger>
            <TabsTrigger value="services" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">Services</TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">Notes</TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-white/40">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
                <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">Contact Info</h3>
                <InfoRow icon={Building} label="Business" value={client.business} />
                <InfoRow icon={Mail} label="Email" value={client.email} />
                <InfoRow icon={Phone} label="Phone" value={client.phone} />
                <InfoRow icon={Globe} label="Website" value={client.website} />
              </div>
              <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
                <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">Billing</h3>
                <div className="text-center py-4">
                  <p className="text-orange-500 text-3xl font-bold">${client.monthlyPayment}</p>
                  <p className="text-white/25 text-xs mt-1">Monthly Payment</p>
                </div>
                <div className="space-y-2">
                  {client.services.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-white/50 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" />
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="services">
            <div className="bg-card rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase mb-4">Active Services</h3>
              <div className="space-y-3">
                {client.services.map((s) => (
                  <div key={s} className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0">
                    <span className="text-white/70 text-sm">{s}</span>
                    <span className="text-green-400/50 text-[10px] font-semibold tracking-wider uppercase">Active</span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notes">
            <div className="bg-card rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase mb-4">Internal Notes</h3>
              <p className="text-white/30 text-sm">No notes yet. Click to add internal notes about this client.</p>
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div className="bg-card rounded-xl border border-white/[0.06] p-5">
              <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase mb-4">Documents</h3>
              <p className="text-white/30 text-sm">No documents uploaded yet.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InfoRow({ icon: RowIcon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <RowIcon className="w-4 h-4 text-white/15" />
      <div>
        <p className="text-white/25 text-[10px] uppercase tracking-wider">{label}</p>
        <p className="text-white/70 text-sm">{value}</p>
      </div>
    </div>
  );
}
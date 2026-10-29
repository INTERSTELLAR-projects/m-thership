import { useState, useEffect } from "react";
import { Search, Plus, Phone, Mail, Globe, Building, ChevronRight, Pencil, Trash2, Check, X, Upload, FileText, ExternalLink, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";
import BrandProfile from "../components/crm/BrandProfile";
import { useRef } from "react";

const statusFilters = ["All", "Active", "Inactive", "Lead"];

export default function CRM() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newClient, setNewClient] = useState({ business: "", contact: "", phone: "", email: "", website: "", status: "Active" });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const data = await base44.entities.CRMClient.list("-created_date", 200);
    if (data.length === 0) {
      // Migrate from localStorage if exists
      try {
        const local = JSON.parse(localStorage.getItem("crm_clients") || "[]");
        if (local.length > 0) {
          for (const c of local) {
            const { id, ...rest } = c;
            await base44.entities.CRMClient.create(rest);
          }
          localStorage.removeItem("crm_clients");
          const migrated = await base44.entities.CRMClient.list("-created_date", 200);
          setClients(migrated);
          setLoading(false);
          return;
        }
      } catch {}
    }
    setClients(data);
    setLoading(false);
  };

  const addClient = async () => {
    if (!newClient.business) return;
    const c = {
      business: newClient.business,
      contact: newClient.contact,
      phones: newClient.phone ? [newClient.phone] : [],
      emails: newClient.email ? [newClient.email] : [],
      websites: newClient.website ? [newClient.website] : [],
      services: [],
      status: newClient.status,
      notes: [],
      documents: [],
      blogSchedule: [],
    };
    const created = await base44.entities.CRMClient.create(c);
    setClients([...clients, created]);
    setAddOpen(false);
    setNewClient({ business: "", contact: "", phone: "", email: "", website: "", status: "Active" });
  };

  const updateClient = async (updated) => {
    const { id, created_date, updated_date, created_by, ...fields } = updated;
    await base44.entities.CRMClient.update(id, fields);
    setClients(clients.map((c) => c.id === id ? updated : c));
  };

  const deleteClient = async (id) => {
    await base44.entities.CRMClient.delete(id);
    setClients(clients.filter((c) => c.id !== id));
  };

  const filtered = clients.filter((c) => {
    const matchSearch = c.business?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const selectedClient = clients.find((c) => c.id === selectedId);

  if (selectedClient) {
    return <ClientDetail client={selectedClient} onBack={() => setSelectedId(null)} onUpdate={updateClient} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / CRM" rightText="Customer Management" />
      <div className="px-8 py-6 space-y-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/[0.38]" />
            <Input placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-9" />
          </div>
          <div className="flex gap-1.5">
            {statusFilters.map((f) => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === f ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-300 border border-orange-500/30 shadow-[0_0_12px_rgba(255,106,0,0.25)]" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{f}</button>
            ))}
          </div>
          <Button onClick={() => setAddOpen(true)} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] h-9 gap-2"><Plus className="w-4 h-4" />Add Client</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {filtered.map((client) => {
              const total = (client.services || []).reduce((s, sv) => s + (sv.price || 0), 0);
              return (
                <div key={client.id} className="card-hover w-full bg-card rounded-xl border border-ink/[0.13] p-4 flex items-center gap-5 group">
                  <button onClick={() => setSelectedId(client.id)} className="flex items-center gap-5 flex-1 text-left min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center shrink-0 overflow-hidden">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.business} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-orange-300 font-display font-extrabold text-sm">{client.business?.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-ink/90 text-sm font-medium">{client.business}</span>
                        <span className="text-green-600/60 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-green-400/10 border border-green-500/20 rounded">{client.status}</span>
                      </div>
                      <p className="text-ink/[0.48] text-xs">{client.contact} · {(client.emails || [])[0]}</p>
                    </div>
                    <div className="text-right mr-2 shrink-0">
                      <p className="text-orange-300 text-sm font-display font-bold">${total}/mo</p>
                      <p className="text-orange-300/40 text-xs">{(client.services || []).length} services</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink/[0.33] group-hover:text-orange-400/60 transition-colors shrink-0" />
                  </button>
                  <button onClick={() => deleteClient(client.id)} className="p-1.5 text-ink/[0.28] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-card border-ink/[0.13] text-ink">
          <DialogHeader><DialogTitle className="text-ink">Add New Client</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-ink/50 text-xs">Business Name</Label><Input value={newClient.business} onChange={(e) => setNewClient({ ...newClient, business: e.target.value })} className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1" /></div>
            <div><Label className="text-ink/50 text-xs">Contact Name</Label><Input value={newClient.contact} onChange={(e) => setNewClient({ ...newClient, contact: e.target.value })} className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-ink/50 text-xs">Phone</Label><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1" /></div>
              <div><Label className="text-ink/50 text-xs">Email</Label><Input value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1" /></div>
            </div>
            <div><Label className="text-ink/50 text-xs">Website</Label><Input value={newClient.website} onChange={(e) => setNewClient({ ...newClient, website: e.target.value })} className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1" /></div>
            <div><Label className="text-ink/50 text-xs">Status</Label>
              <Select value={newClient.status} onValueChange={(v) => setNewClient({ ...newClient, status: v })}>
                <SelectTrigger className="bg-ink/[0.03] border-ink/[0.13] text-ink mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-ink/[0.13]">
                  {["Active", "Inactive", "Lead"].map((s) => <SelectItem key={s} value={s} className="text-ink/70">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addClient} className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)]">Add Client</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientDetail({ client, onBack, onUpdate }) {
  const update = (changes) => onUpdate({ ...client, ...changes });

  return (
    <div className="min-h-screen bg-background">
      <div className="relative overflow-hidden flex items-center gap-3 px-8 py-5 border-b border-orange-500/[0.12]">
        <div className="absolute -top-8 right-1/3 w-32 h-32 rounded-full bg-orange-500/[0.05] blur-3xl pointer-events-none" />
        <button onClick={onBack} className="relative text-ink/[0.48] hover:text-orange-400/70 text-sm transition-colors">← Back</button>
        <span className="relative text-orange-500/40">/</span>
        <div className="relative w-1 h-4 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400 shadow-[0_0_10px_rgba(255,106,0,0.7)]" />
        <span className="relative font-display font-bold text-sm tracking-[0.1em] bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{client.business}</span>
      </div>
      <div className="px-8 py-6">
        <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-card border border-ink/[0.13] mb-6 flex-wrap h-auto gap-1">
              {[
                { value: "overview", label: "Overview" },
                { value: "services", label: "Services" },
                { value: "notes", label: "Notes" },
                { value: "documents", label: "Documents" },
                { value: "tasks", label: "Tasks" },
                { value: "requests", label: "Requests" },
                { value: "completed-requests", label: "Completed Requests" },
                { value: "completed-tasks", label: "Completed Tasks" },
              ].map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="data-[state=active]:bg-orange-500/15 data-[state=active]:text-orange-500 text-ink/[0.58]">{t.label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview"><ContactTab client={client} update={update} /></TabsContent>
          <TabsContent value="services"><ServicesTab client={client} update={update} /></TabsContent>
          <TabsContent value="notes"><NotesTab client={client} update={update} /></TabsContent>
          <TabsContent value="documents"><DocumentsTab client={client} update={update} /></TabsContent>
          <TabsContent value="tasks"><TasksTab client={client} /></TabsContent>
          <TabsContent value="requests"><RequestsTab client={client} update={update} /></TabsContent>
          <TabsContent value="completed-requests"><CompletedRequestsTab client={client} update={update} /></TabsContent>
          <TabsContent value="completed-tasks"><CompletedTasksTab client={client} update={update} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ContactTab({ client, update }) {
  const [editing, setEditing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    business: client.business,
    contact: client.contact,
    status: client.status,
    phones: [...(client.phones || [])],
    emails: [...(client.emails || [])],
    websites: [...(client.websites || [])],
  });

  const save = () => {
    update({ ...form, phones: form.phones.filter(Boolean), emails: form.emails.filter(Boolean), websites: form.websites.filter(Boolean) });
    setEditing(false);
  };

  const addField = (field) => setForm({ ...form, [field]: [...form[field], ""] });
  const updateField = (field, i, val) => { const arr = [...form[field]]; arr[i] = val; setForm({ ...form, [field]: arr }); };
  const removeField = (field, i) => setForm({ ...form, [field]: form[field].filter((_, idx) => idx !== i) });

  const total = (client.services || []).reduce((s, sv) => s + (sv.price || 0), 0);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await update({ ...client, logoUrl: file_url });
    setUploadingLogo(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="game-panel p-5">
        <div className="flex items-center gap-4 mb-4">
          <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} className="hidden" id="logo-upload" />
          <label htmlFor="logo-upload" className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-orange-500/30 flex items-center justify-center cursor-pointer hover:border-orange-500/60 transition-colors ${client.logoUrl ? 'bg-orange-500/5' : 'bg-ink/[0.02]'}`}>
            {uploadingLogo ? (
              <Loader2 className="w-6 h-6 text-orange-500/40 animate-spin" />
            ) : client.logoUrl ? (
              <img src={client.logoUrl} alt="Logo" className="w-full h-full object-cover rounded" />
            ) : (
              <Plus className="w-5 h-5 text-orange-500/40" />
            )}
          </label>
          <div className="flex-1">
            <h3 className="text-ink font-bold text-sm">{client.business}</h3>
            <p className="text-ink/[0.48] text-xs mt-1">Click logo to upload</p>
          </div>
          <div className="flex items-center justify-end">
            {editing ? (
              <div className="flex gap-2">
                <button onClick={save} className="flex items-center gap-1 text-green-600/70 hover:text-green-600 text-xs"><Save className="w-3.5 h-3.5" />Save</button>
                <button onClick={() => setEditing(false)} className="text-ink/[0.48] hover:text-ink/60 text-xs">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-ink/[0.38] hover:text-ink/50 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>
        <div className="border-t border-ink/[0.13] pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Contact Details</h3>
          </div>
          {editing ? (
            <div className="space-y-3">
              <EditField label="Business Name" value={form.business} onChange={(v) => setForm({ ...form, business: v })} />
              <EditField label="Contact Name" value={form.contact} onChange={(v) => setForm({ ...form, contact: v })} />
              <div>
                <Label className="text-ink/[0.58] text-[10px] uppercase tracking-wider">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 mt-1 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-ink/[0.13]">
                    {["Active", "Inactive", "Lead"].map((s) => <SelectItem key={s} value={s} className="text-ink/70">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <MultiField label="Phone" icon={Phone} values={form.phones} onAdd={() => addField("phones")} onUpdate={(i, v) => updateField("phones", i, v)} onRemove={(i) => removeField("phones", i)} />
              <MultiField label="Email" icon={Mail} values={form.emails} onAdd={() => addField("emails")} onUpdate={(i, v) => updateField("emails", i, v)} onRemove={(i) => removeField("emails", i)} />
              <MultiField label="Website" icon={Globe} values={form.websites} onAdd={() => addField("websites")} onUpdate={(i, v) => updateField("websites", i, v)} onRemove={(i) => removeField("websites", i)} />
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow icon={Building} label="Business" value={client.business} />
              <InfoRow icon={Building} label="Contact" value={client.contact} />
              {(client.phones || []).map((p, i) => <InfoRow key={i} icon={Phone} label={i === 0 ? "Phone" : ""} value={p} />)}
              {(client.emails || []).map((e, i) => <InfoRow key={i} icon={Mail} label={i === 0 ? "Email" : ""} value={e} />)}
              {(client.websites || []).map((w, i) => <InfoRow key={i} icon={Globe} label={i === 0 ? "Website" : ""} value={w} />)}
            </div>
          )}
        </div>
        </div>
        </div>
        <div className="col-span-2">
        <BrandProfile clientId={client.id} initialData={client.brandProfile || {}} />
        </div>
        </div>
        );
        }

function ServicesTab({ client, update }) {
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});
  const [adding, setAdding] = useState(false);
  const [newSvc, setNewSvc] = useState({ name: "", price: "" });

  const save = (services) => update({ services });
  const del = (id) => save((client.services || []).filter((s) => s.id !== id));
  const startEdit = (s) => { setEditId(s.id); setEditVal({ ...s }); };
  const saveEdit = () => { save((client.services || []).map((s) => s.id === editId ? { ...editVal, price: parseFloat(editVal.price) || 0 } : s)); setEditId(null); };
  const add = () => {
    if (!newSvc.name) return;
    save([...(client.services || []), { id: Date.now(), name: newSvc.name, price: parseFloat(newSvc.price) || 0 }]);
    setAdding(false); setNewSvc({ name: "", price: "" });
  };

  const total = (client.services || []).reduce((s, sv) => s + (sv.price || 0), 0);

  return (
    <div className="space-y-4">
      <div className="game-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Services & Billing</h3>
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-orange-500/60 hover:text-orange-500 text-xs transition-colors"><Plus className="w-3.5 h-3.5" />Add Service</button>
        </div>
        <div className="space-y-2">
          {(client.services || []).map((s) => editId === s.id ? (
            <div key={s.id} className="flex items-center gap-2 py-2">
              <Input value={editVal.name} onChange={(e) => setEditVal({ ...editVal, name: e.target.value })} className="flex-1 h-8 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" placeholder="Service name" />
              <Input value={editVal.price} onChange={(e) => setEditVal({ ...editVal, price: e.target.value })} type="number" className="w-24 h-8 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" placeholder="Price" />
              <button onClick={saveEdit} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditId(null)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div key={s.id} className="flex items-center justify-between py-3 border-b border-ink/[0.13] last:border-0 group">
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500/50" /><span className="text-ink/70 text-sm">{s.name}</span></div>
              <div className="flex items-center gap-3">
                <span className="text-orange-500/70 text-sm font-medium">${s.price}/mo</span>
                <button onClick={() => startEdit(s)} className="p-1 text-ink/[0.33] hover:text-ink/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(s.id)} className="p-1 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {adding && (
            <div className="flex items-center gap-2 py-2 border-t border-ink/[0.13] mt-2">
              <Input value={newSvc.name} onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })} className="flex-1 h-8 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" placeholder="Service name" autoFocus />
              <Input value={newSvc.price} onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })} type="number" className="w-24 h-8 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" placeholder="$/mo" />
              <button onClick={add} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setAdding(false)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-ink/[0.13] flex justify-between items-center">
          <span className="text-ink/[0.58] text-xs uppercase tracking-wider">Total Monthly</span>
          <span className="font-display font-bold text-lg bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">${total}/mo</span>
        </div>
      </div>
      <BlogScheduleSection client={client} update={update} />
    </div>
  );
}

const FREQ_OPTIONS = ["per week", "per month"];

function BlogScheduleSection({ client, update }) {
  const schedule = client.blogSchedule || [];
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState({ type: "Website Blog", count: 1, frequency: "per month" });
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState({});

  const save = (blogSchedule) => update({ blogSchedule });
  const del = (id) => save(schedule.filter((s) => s.id !== id));
  const startEdit = (s) => { setEditId(s.id); setEditVal({ ...s }); };
  const saveEdit = () => { save(schedule.map((s) => s.id === editId ? { ...editVal, count: parseInt(editVal.count) || 1 } : s)); setEditId(null); };
  const add = () => {
    if (!newEntry.type) return;
    save([...schedule, { ...newEntry, count: parseInt(newEntry.count) || 1, id: Date.now() }]);
    setAdding(false);
    setNewEntry({ type: "Website Blog", count: 1, frequency: "per month" });
  };

  return (
    <div className="game-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Blog & Content Schedule</h3>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-orange-500/60 hover:text-orange-500 text-xs transition-colors"><Plus className="w-3.5 h-3.5" />Add Entry</button>
      </div>
      <div className="space-y-2">
        {schedule.length === 0 && !adding && <p className="text-ink/[0.38] text-xs">No schedule set yet.</p>}
        {schedule.map((s) => editId === s.id ? (
          <div key={s.id} className="flex items-center gap-2 py-2 flex-wrap">
            <input value={editVal.type} onChange={(e) => setEditVal({ ...editVal, type: e.target.value })} className="flex-1 min-w-[140px] h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none" placeholder="Type" />
            <input type="number" min="1" value={editVal.count} onChange={(e) => setEditVal({ ...editVal, count: e.target.value })} className="w-16 h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none" />
            <select value={editVal.frequency} onChange={(e) => setEditVal({ ...editVal, frequency: e.target.value })} className="h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none">
              {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={saveEdit} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditId(null)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div key={s.id} className="flex items-center justify-between py-3 border-b border-ink/[0.13] last:border-0 group">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-orange-500/30" /><span className="text-ink/70 text-sm">{s.type}</span></div>
            <div className="flex items-center gap-3">
              <span className="text-orange-500/60 text-sm font-medium">{s.count}x {s.frequency}</span>
              <button onClick={() => startEdit(s)} className="p-1 text-ink/[0.33] hover:text-ink/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => del(s.id)} className="p-1 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {adding && (
          <div className="flex items-center gap-2 py-2 border-t border-ink/[0.13] mt-2 flex-wrap">
            <input value={newEntry.type} onChange={(e) => setNewEntry({ ...newEntry, type: e.target.value })} className="flex-1 min-w-[140px] h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none" placeholder="e.g. Website Blog" autoFocus />
            <input type="number" min="1" value={newEntry.count} onChange={(e) => setNewEntry({ ...newEntry, count: e.target.value })} className="w-16 h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none" />
            <select value={newEntry.frequency} onChange={(e) => setNewEntry({ ...newEntry, frequency: e.target.value })} className="h-8 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 text-ink text-xs outline-none">
              {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <button onClick={add} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAdding(false)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function NotesTab({ client, update }) {
  const [newNote, setNewNote] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const saveNotes = (notes) => update({ notes });
  const saveEdit = (id) => {
    const note = (client.notes || []).find((n) => n.id === id);
    if (!note) return;
    saveNotes((client.notes || []).map((n) => n.id === id ? { ...n, text: editText } : n));
    setEditId(null);
  };
  const delNote = (id) => saveNotes((client.notes || []).filter((n) => n.id !== id));
  const addNote = () => {
    if (!newNote.trim()) return;
    saveNotes([...(client.notes || []), { id: Date.now(), text: newNote.trim(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }]);
    setNewNote("");
  };

  return (
    <div className="game-panel p-5">
      <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Internal Notes</h3>
      <div className="space-y-3 mb-4">
        {(client.notes || []).length === 0 && <p className="text-ink/[0.43] text-sm">No notes yet.</p>}
        {(client.notes || []).map((n) => (
          <div key={n.id} className="bg-ink/[0.02] rounded-lg border border-ink/[0.13] p-3 group">
            <div className="flex items-start justify-between gap-3">
              {editId === n.id ? (
                <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-sm text-ink outline-none resize-none min-h-[60px]" />
              ) : (
                <p className="flex-1 text-ink/70 text-sm whitespace-pre-wrap">{n.text}</p>
              )}
              <div className="flex gap-1 shrink-0">
                {editId === n.id ? (
                  <><button onClick={() => saveEdit(n.id)} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button><button onClick={() => setEditId(null)} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button></>
                ) : (
                  <><button onClick={() => { setEditId(n.id); setEditText(n.text); }} className="p-1 text-ink/[0.33] hover:text-ink/50 opacity-0 group-hover:opacity-100 transition-all"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => delNote(n.id)} className="p-1 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button></>
                )}
              </div>
            </div>
            <p className="text-ink/[0.38] text-[10px] mt-2">{n.date}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note..." className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 pr-9 text-sm text-ink placeholder:text-ink/[0.38] outline-none resize-none min-h-[80px]" />
          <MicButton onResult={(t) => setNewNote((p) => p + (p ? " " : "") + t)} className="absolute top-2 right-1" />
        </div>
        <button onClick={addNote} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] text-xs font-semibold rounded-lg transition-colors self-end">Add</button>
      </div>
    </div>
  );
}

function DocumentsTab({ client, update }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const saveDocs = (documents) => update({ documents });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const newDocs = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newDocs.push({ id: Date.now() + Math.random(), name: file.name, url: file_url, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
    }
    saveDocs([...(client.documents || []), ...newDocs]);
    setUploading(false);
    e.target.value = "";
  };

  const del = (id) => saveDocs((client.documents || []).filter((d) => d.id !== id));

  return (
    <div className="game-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Documents</h3>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <Button onClick={() => fileRef.current.click()} disabled={uploading} className="bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold shadow-[0_0_14px_rgba(255,106,0,0.25)] h-8 gap-2 text-xs">
          <Upload className="w-3.5 h-3.5" />{uploading ? "Uploading..." : "Upload"}
        </Button>
      </div>
      {(!(client.documents) || client.documents.length === 0) ? (
        <p className="text-ink/[0.43] text-sm">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {client.documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 py-2 px-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13] group">
              <FileText className="w-4 h-4 text-orange-500/40 shrink-0" />
              <div className="flex-1 min-w-0"><p className="text-ink/70 text-sm truncate">{doc.name}</p><p className="text-ink/[0.38] text-xs">{doc.date}</p></div>
              <a href={doc.url} target="_blank" rel="noreferrer" className="p-1.5 text-ink/[0.38] hover:text-ink/60 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
              <button onClick={() => del(doc.id)} className="p-1.5 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-ink/[0.33] shrink-0" />
      <div>
        {label && <p className="text-ink/[0.43] text-[10px] uppercase tracking-wider">{label}</p>}
        <p className="text-ink/70 text-sm">{value}</p>
      </div>
    </div>
  );
}

function EditField({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-ink/[0.58] text-[10px] uppercase tracking-wider">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 mt-1 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" />
    </div>
  );
}

function MultiField({ label, icon: Icon, values, onAdd, onUpdate, onRemove }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-ink/[0.58] text-[10px] uppercase tracking-wider">{label}</Label>
        <button onClick={onAdd} className="text-ink/[0.38] hover:text-orange-500/60 transition-colors"><Plus className="w-3 h-3" /></button>
      </div>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1">
          <Icon className="w-3.5 h-3.5 text-ink/[0.33] shrink-0" />
          <Input value={v} onChange={(e) => onUpdate(i, e.target.value)} className="h-7 flex-1 bg-ink/[0.04] border-ink/[0.13] text-ink text-xs" />
          {values.length > 1 && <button onClick={() => onRemove(i)} className="p-0.5 text-ink/[0.33] hover:text-red-600/60"><X className="w-3 h-3" /></button>}
          </div>
          ))}
          </div>
          );
          }

          const CARD_OPTIONS = ["Website Updates", "GBP Updates", "New Website Builds", "Presentations", "Other"];
          const STATUS_OPTIONS = ["Pending", "In Progress", "Completed"];
          const STATUS_STYLES = {
            Pending: "bg-ink/5 text-ink/[0.53] border-ink/[0.13]",
            "In Progress": "bg-orange-500/15 text-orange-400 border-orange-500/25",
            Completed: "bg-green-500/15 text-green-600 border-green-500/25",
          };

          function TasksTab({ client }) {
            const [tasks, setTasks] = useState([]);
            const [loading, setLoading] = useState(true);
            const [adding, setAdding] = useState(false);
            const [newText, setNewText] = useState("");
            const [newCard, setNewCard] = useState("Website Updates");
            const [newDue, setNewDue] = useState("");

            useEffect(() => {
              base44.entities.ClientOperationItem.filter({ client: client.business }, "created_date", 200).then((data) => {
                setTasks(data);
                setLoading(false);
              });
            }, [client.business]);

            const add = async () => {
              if (!newText.trim()) return;
              const created = await base44.entities.ClientOperationItem.create({
                card: newCard,
                text: newText.trim(),
                client: client.business,
                due: newDue || null,
                status: "Pending",
                done: false,
              });
              setTasks((prev) => [...prev, created]);
              setNewText(""); setNewDue(""); setAdding(false);
            };

            const setStatus = async (t, status) => {
              const done = status === "Completed";
              await base44.entities.ClientOperationItem.update(t.id, { status, done });
              setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status, done } : x));

              if (done) {
                const completedTasks = [...(client.completedTasks || []), {
                  id: Date.now(),
                  text: t.text,
                  card: t.card,
                  completedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  due: t.due || null,
                }];
                await base44.entities.CRMClient.update(client.id, { completedTasks });
              }
            };

            const del = async (id) => {
              await base44.entities.ClientOperationItem.delete(id);
              setTasks((prev) => prev.filter((t) => t.id !== id));
            };

            const active = tasks.filter((t) => !t.done);
            const completed = tasks.filter((t) => t.done);

            return (
              <div className="space-y-4">
                <div className="game-panel p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Active Tasks <span className="text-ink/[0.43] font-normal">({active.length})</span></h3>
                    <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs transition-colors"><Plus className="w-3.5 h-3.5" />Add Task</button>
                  </div>

                  {adding && (
                    <div className="flex items-center gap-2 mb-4 flex-wrap border border-orange-500/15 rounded-lg p-3 bg-orange-500/[0.03]">
                      <input autoFocus value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }} placeholder="Task description..." className="flex-1 min-w-[180px] bg-ink/[0.04] border border-ink/[0.13] rounded px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
                      <select value={newCard} onChange={(e) => setNewCard(e.target.value)} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink/70 outline-none">
                        {CARD_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} className="bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1.5 text-xs text-ink/60 outline-none" />
                      <button onClick={add} className="p-1.5 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setAdding(false)} className="p-1.5 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}

                  {loading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-ink/[0.38] animate-spin" /></div>
                  ) : active.length === 0 && !adding ? (
                    <p className="text-ink/[0.43] text-sm">No active tasks. Add one above.</p>
                  ) : (
                    <div className="space-y-2">
                      {active.map((t) => (
                        <div key={t.id} className="flex items-start gap-3 py-3 px-4 bg-ink/[0.02] rounded-lg border border-ink/[0.13] group">
                          <div className="flex-1 min-w-0">
                            <p className="text-ink/75 text-sm">{t.text}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-ink/[0.43] text-[10px]">{t.card}</span>
                              {t.due && <span className="text-orange-500/50 text-[10px]">Due {new Date(t.due + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                            </div>
                            <div className="flex gap-1.5 mt-2">
                              {STATUS_OPTIONS.map((s) => (
                                <button key={s} onClick={() => setStatus(t, s)} className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                                  (t.status || "Pending") === s ? STATUS_STYLES[s] : "text-ink/[0.38] border-transparent hover:text-ink/[0.58]"
                                }`}>{s}</button>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => del(t.id)} className="p-1 text-ink/[0.28] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          function RequestsTab({ client, update }) {
          const requests = (client.requests || []).filter((r) => r.status !== "Completed");

          return (
          <div className="game-panel p-5">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-4">Active Requests</h3>
          {requests.length === 0 ? (
          <p className="text-ink/[0.43] text-sm">No active requests. Requests submitted through the portal will appear here.</p>
          ) : (
          <div className="space-y-3">
          {requests.map((req, i) => (
           <div key={i} className="bg-ink/[0.02] rounded-lg border border-ink/[0.13] p-3">
             <div className="flex items-start justify-between gap-2">
               <div className="flex-1 min-w-0">
                 <p className="text-ink/70 text-sm font-medium">{req.title}</p>
                 <p className="text-ink/[0.58] text-xs mt-1">{req.description}</p>
                 <p className="text-ink/[0.38] text-[10px] mt-2">{req.date}</p>
               </div>
               <span className="text-orange-500/60 text-[10px] font-semibold px-2 py-1 bg-orange-500/10 rounded shrink-0">{req.status || 'New'}</span>
             </div>
           </div>
          ))}
          </div>
          )}
          </div>
          );
          }

          function CompletedRequestsTab({ client, update }) {
          const completed = (client.requests || []).filter((r) => r.status === "Completed").slice().reverse();

          return (
          <div className="game-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Completed Requests</h3>
              <span className="text-ink/[0.43] text-xs">{completed.length} total</span>
            </div>
            {completed.length === 0 ? (
              <p className="text-ink/[0.43] text-sm">No completed requests yet. Requests marked as Completed will appear here.</p>
            ) : (
              <div className="space-y-2">
                {completed.map((req, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 px-4 bg-ink/[0.02] rounded-lg border border-green-500/10">
                    <CheckCircle2 className="w-4 h-4 text-green-600/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-ink/70 text-sm font-medium">{req.title}</p>
                      {req.description && <p className="text-ink/[0.53] text-xs mt-0.5">{req.description}</p>}
                      {req.date && <p className="text-ink/[0.38] text-[10px] mt-1">Submitted {req.date}</p>}
                    </div>
                    <span className="text-green-600/60 text-[10px] font-semibold px-2 py-0.5 bg-green-500/10 rounded">Completed</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
          }

          function CompletedTasksTab({ client, update }) {
          const tasks = (client.completedTasks || []).slice().reverse();

          const del = (id) => {
            const completedTasks = (client.completedTasks || []).filter((t) => t.id !== id);
            update({ completedTasks });
          };

          return (
          <div className="game-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Completed Tasks</h3>
              <span className="text-ink/[0.43] text-xs">{tasks.length} total</span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-ink/[0.43] text-sm">No completed tasks yet. Tasks marked complete in Client Projects will appear here.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 py-3 px-4 bg-ink/[0.02] rounded-lg border border-ink/[0.13] group">
                    <CheckCircle2 className="w-4 h-4 text-green-600/60 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-ink/70 text-sm">{t.text}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-ink/[0.43] text-[10px]">{t.card}</span>
                        {t.completedDate && <span className="text-green-600/50 text-[10px]">Completed {t.completedDate}</span>}
                        {t.due && <span className="text-ink/[0.38] text-[10px]">Was due {new Date(t.due + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                    <button onClick={() => del(t.id)} className="p-1 text-ink/[0.28] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
          }
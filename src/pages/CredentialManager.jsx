import { useState } from "react";
import { Search, Plus, Eye, EyeOff, Copy, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";

const sampleData = [
  { id: 1, platform: "Gmail", category: "Email", email: "interstellarstrategiesllc@gmail.com", username: "interstellarstrategiesllc", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 2, platform: "Gmail", category: "Email", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 3, platform: "ClickUp", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 4, platform: "Squarespace", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 5, platform: "Google Workspace", category: "Email", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 6, platform: "ZenBusiness", category: "Billing", email: "interstellarstrategiesllc@gmail.com", username: "interstellarstrategiesllc", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 7, platform: "Envato", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 8, platform: "Mercury BBA", category: "Billing", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox12344", loginType: "Email + Password", notes: "" },
  { id: 9, platform: "PayPal", category: "Billing", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 10, platform: "Webflow", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 11, platform: "ChatGPT", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 12, platform: "Canva", category: "Social Tools", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 13, platform: "Stripe", category: "Billing", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 14, platform: "Zapier", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 15, platform: "GitHub", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox000$", loginType: "Email + Password", notes: "" },
  { id: 16, platform: "Render", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 17, platform: "QuickBooks", category: "Billing", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 18, platform: "Netlify", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 19, platform: "Serp API", category: "SEO", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 20, platform: "Interstellar Reviews Dashboard", category: "SEO", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 21, platform: "Spline", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 22, platform: "Wix", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 23, platform: "Framer", category: "Hosting", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 24, platform: "Typeform", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 25, platform: "XAI", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 26, platform: "Cursor", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 27, platform: "Relume", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 28, platform: "Search Atlas", category: "SEO", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 29, platform: "Aragon", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 30, platform: "Genspark", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 31, platform: "Looka", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 32, platform: "Base44", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 33, platform: "Claude", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 34, platform: "Custom E-Signature", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 35, platform: "DocuSign", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 36, platform: "Motion", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 37, platform: "Clockify", category: "Other", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 38, platform: "Eleven Labs", category: "Billing", email: "Google Login", username: "Google Login", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 39, platform: "Coursera", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 40, platform: "MyClaw", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 41, platform: "Semrush", category: "SEO", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 42, platform: "Veed", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 43, platform: "SMPL Social", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 44, platform: "Vistaprint", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 45, platform: "Feedbird", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 46, platform: "AirTable", category: "Other", email: "justin@interstellar-strategies.com", username: "justin", password: "Google Login", loginType: "Google Login", notes: "" },
  { id: 47, platform: "Instagram", category: "Social Tools", email: "interstellarstrategies", username: "interstellarstrategies", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
  { id: 48, platform: "LinkedIn", category: "Social Tools", email: "justin@interstellar-strategies.com", username: "justin", password: "Paradox1234$", loginType: "Email + Password", notes: "" },
];

const categories = ["All", "Email", "Hosting", "SEO", "Billing", "Social Tools", "Other"];

export default function CredentialManager() {
  const [logins, setLogins] = useState(sampleData);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [editingLogin, setEditingLogin] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLogin, setNewLogin] = useState({ platform: "", category: "", email: "", username: "", password: "", loginType: "Email + Password", notes: "" });

  const handleDelete = (id) => {
    setLogins((prev) => prev.filter((l) => l.id !== id));
  };

  const handleEditSave = () => {
    setLogins((prev) => prev.map((l) => l.id === editingLogin.id ? editingLogin : l));
    setEditingLogin(null);
  };

  const handleAdd = () => {
    const id = Date.now();
    setLogins((prev) => [...prev, { ...newLogin, id }]);
    setNewLogin({ platform: "", category: "", email: "", username: "", password: "", loginType: "Email + Password", notes: "" });
    setAddOpen(false);
  };

  const filtered = logins.filter((login) => {
    const matchSearch =
      login.platform.toLowerCase().includes(search.toLowerCase()) ||
      login.email.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === "All" || login.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const togglePassword = (id) => {
    setVisiblePasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Logins" rightText="Credential Manager" />

      <div className="px-8 py-6 space-y-5">
        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input
              placeholder="Search logins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat
                    ? "bg-orange-500/15 text-orange-500 border border-orange-500/20"
                    : "text-white/30 hover:text-white/50 border border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          {/* Edit Dialog */}
          <Dialog open={!!editingLogin} onOpenChange={(o) => !o && setEditingLogin(null)}>
            <DialogContent className="bg-card border-white/[0.06] text-white">
              <DialogHeader><DialogTitle className="text-white">Edit Login</DialogTitle></DialogHeader>
              {editingLogin && (
                <div className="space-y-4 pt-2">
                  <div><Label className="text-white/50 text-xs">Platform</Label><Input value={editingLogin.platform} onChange={(e) => setEditingLogin({...editingLogin, platform: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                  <div><Label className="text-white/50 text-xs">Category</Label>
                    <Select value={editingLogin.category} onValueChange={(v) => setEditingLogin({...editingLogin, category: v})}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-white/[0.06]">{categories.filter((c) => c !== "All").map((cat) => <SelectItem key={cat} value={cat} className="text-white/70">{cat}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-white/50 text-xs">Email</Label><Input value={editingLogin.email} onChange={(e) => setEditingLogin({...editingLogin, email: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                    <div><Label className="text-white/50 text-xs">Username</Label><Input value={editingLogin.username} onChange={(e) => setEditingLogin({...editingLogin, username: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                  </div>
                  <div><Label className="text-white/50 text-xs">Login Type</Label>
                    <Select value={editingLogin.loginType} onValueChange={(v) => setEditingLogin({...editingLogin, loginType: v})}>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-white/[0.06]">
                        <SelectItem value="Email + Password" className="text-white/70">Email + Password</SelectItem>
                        <SelectItem value="Google Login" className="text-white/70">Google Login</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editingLogin.loginType === "Email + Password" && <div><Label className="text-white/50 text-xs">Password</Label><Input value={editingLogin.password} onChange={(e) => setEditingLogin({...editingLogin, password: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>}
                  <div><Label className="text-white/50 text-xs">Notes</Label><Input value={editingLogin.notes} onChange={(e) => setEditingLogin({...editingLogin, notes: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                  <Button onClick={handleEditSave} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save Changes</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Dialog */}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
                <Plus className="w-4 h-4" />
                Add Login
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/[0.06] text-white">
              <DialogHeader><DialogTitle className="text-white">Add New Login</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label className="text-white/50 text-xs">Platform</Label><Input value={newLogin.platform} onChange={(e) => setNewLogin({...newLogin, platform: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                <div><Label className="text-white/50 text-xs">Category</Label>
                  <Select value={newLogin.category} onValueChange={(v) => setNewLogin({...newLogin, category: v})}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent className="bg-card border-white/[0.06]">{categories.filter((c) => c !== "All").map((cat) => <SelectItem key={cat} value={cat} className="text-white/70">{cat}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-white/50 text-xs">Email</Label><Input value={newLogin.email} onChange={(e) => setNewLogin({...newLogin, email: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                  <div><Label className="text-white/50 text-xs">Username</Label><Input value={newLogin.username} onChange={(e) => setNewLogin({...newLogin, username: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                </div>
                <div><Label className="text-white/50 text-xs">Login Type</Label>
                  <Select value={newLogin.loginType} onValueChange={(v) => setNewLogin({...newLogin, loginType: v})}>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-card border-white/[0.06]">
                      <SelectItem value="Email + Password" className="text-white/70">Email + Password</SelectItem>
                      <SelectItem value="Google Login" className="text-white/70">Google Login</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newLogin.loginType === "Email + Password" && <div><Label className="text-white/50 text-xs">Password</Label><Input value={newLogin.password} onChange={(e) => setNewLogin({...newLogin, password: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>}
                <div><Label className="text-white/50 text-xs">Notes</Label><Input value={newLogin.notes} onChange={(e) => setNewLogin({...newLogin, notes: e.target.value})} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                <Button onClick={handleAdd} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save Login</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Login Cards */}
        <div className="space-y-2">
          {filtered.map((login) => (
            <div
              key={login.id}
              className="bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-6 group hover:border-orange-500/15 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold">
                {login.platform.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white/90 text-sm font-medium">{login.platform}</span>
                  <span className="text-orange-500/50 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 bg-orange-500/5 rounded">
                    {login.category}
                  </span>
                </div>
                <p className="text-white/30 text-xs">{login.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {login.loginType === "Google Login" ? (
                  <span className="text-blue-400/60 text-xs font-semibold tracking-wider px-2 py-0.5 bg-blue-500/5 rounded border border-blue-500/10">Google Login</span>
                ) : (
                  <>
                    <span className="text-white/25 text-xs font-mono w-24">
                      {visiblePasswords[login.id] ? login.password : "••••••••"}
                    </span>
                    <button onClick={() => togglePassword(login.id)} className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                      {visiblePasswords[login.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button onClick={() => setEditingLogin(login)} className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(login.id)} className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-red-400/50 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
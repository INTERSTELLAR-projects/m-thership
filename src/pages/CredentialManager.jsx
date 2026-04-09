import { useState } from "react";
import { Search, Plus, Eye, EyeOff, Copy, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";

const sampleData = [
  { id: 1, platform: "Google Workspace", category: "Email", email: "admin@interstellar.com", username: "admin", password: "••••••••", notes: "Main admin account", tags: ["primary", "admin"] },
  { id: 2, platform: "Cloudflare", category: "Hosting", email: "dev@interstellar.com", username: "interstellar-dev", password: "••••••••", notes: "DNS management", tags: ["infrastructure"] },
  { id: 3, platform: "SEMrush", category: "SEO", email: "seo@interstellar.com", username: "interstellar_seo", password: "••••••••", notes: "Ørbit SEO main tool", tags: ["seo", "tools"] },
  { id: 4, platform: "Stripe", category: "Billing", email: "billing@interstellar.com", username: "interstellar", password: "••••••••", notes: "Payment processing", tags: ["finance"] },
  { id: 5, platform: "Vercel", category: "Hosting", email: "dev@interstellar.com", username: "interstellar-team", password: "••••••••", notes: "Website deployments", tags: ["infrastructure", "web"] },
];

const categories = ["All", "Email", "Hosting", "SEO", "Billing", "Social", "Tools", "Other"];

export default function CredentialManager() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const filtered = sampleData.filter((login) => {
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
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
                <Plus className="w-4 h-4" />
                Add Login
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/[0.06] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Login</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-white/50 text-xs">Platform</Label>
                  <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                </div>
                <div>
                  <Label className="text-white/50 text-xs">Category</Label>
                  <Select>
                    <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/[0.06]">
                      {categories.filter((c) => c !== "All").map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-white/70">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/50 text-xs">Email</Label>
                    <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs">Username</Label>
                    <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-white/50 text-xs">Password</Label>
                  <Input type="password" className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                </div>
                <div>
                  <Label className="text-white/50 text-xs">Notes</Label>
                  <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">Save Login</Button>
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
              <div className="flex items-center gap-2">
                <span className="text-white/25 text-xs font-mono w-24">
                  {visiblePasswords[login.id] ? "p@ssw0rd123" : "••••••••"}
                </span>
                <button onClick={() => togglePassword(login.id)} className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                  {visiblePasswords[login.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-white/50 transition-all">
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded-md hover:bg-white/5 text-white/20 hover:text-red-400/50 transition-all">
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
import { useState } from "react";
import { Search, Upload, Pin, FileText, Folder, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "../components/PageHeader";

const documentCategories = [
  { name: "Internal Processes", count: 12, icon: Folder },
  { name: "Service Documents", count: 8, icon: FileText },
  { name: "Contracts & Agreements", count: 15, icon: FileText },
  { name: "Presentations", count: 6, icon: FileText },
  { name: "Legal Documents", count: 9, icon: FileText },
  { name: "Financial Documents", count: 11, icon: FileText },
];

const recentDocs = [
  { name: "Q1 Revenue Report", category: "Financial Documents", date: "Mar 28, 2026", pinned: true },
  { name: "Ørbit SEO Service Agreement", category: "Contracts & Agreements", date: "Mar 25, 2026", pinned: true },
  { name: "Client Onboarding SOP", category: "Internal Processes", date: "Mar 22, 2026", pinned: false },
  { name: "NW Tree Service Proposal", category: "Presentations", date: "Mar 20, 2026", pinned: false },
  { name: "Privacy Policy v2.3", category: "Legal Documents", date: "Mar 18, 2026", pinned: false },
  { name: "Monthly Expense Sheet", category: "Financial Documents", date: "Mar 15, 2026", pinned: false },
];

export default function Documents() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Pinned", "Recent", ...documentCategories.map((c) => c.name)];

  const filteredDocs = recentDocs.filter((doc) => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "All") return matchSearch;
    if (activeFilter === "Pinned") return matchSearch && doc.pinned;
    if (activeFilter === "Recent") return matchSearch;
    return matchSearch && doc.category === activeFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Documents" rightText="Document Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-white/[0.06] text-white placeholder:text-white/20 h-9"
            />
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-3 gap-3">
          {documentCategories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveFilter(cat.name)}
              className={`bg-card rounded-xl border p-4 text-left transition-all hover:border-orange-500/20 ${
                activeFilter === cat.name ? "border-orange-500/30 bg-orange-500/[0.03]" : "border-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <cat.icon className="w-4 h-4 text-orange-500/50" />
                <span className="text-white/20 text-xs font-medium">{cat.count}</span>
              </div>
              <p className="text-white/70 text-sm font-medium">{cat.name}</p>
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {["All", "Pinned", "Recent"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === f
                  ? "bg-orange-500/15 text-orange-500 border border-orange-500/20"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Document List */}
        <div className="space-y-2">
          {filteredDocs.map((doc) => (
            <div
              key={doc.name}
              className="bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-4 group hover:border-orange-500/15 transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-500/[0.06] flex items-center justify-center">
                <FileText className="w-4 h-4 text-orange-500/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white/85 text-sm font-medium">{doc.name}</span>
                  {doc.pinned && <Pin className="w-3 h-3 text-orange-500/50" />}
                </div>
                <p className="text-white/25 text-xs mt-0.5">{doc.category}</p>
              </div>
              <div className="flex items-center gap-2 text-white/20 text-xs">
                <Clock className="w-3 h-3" />
                {doc.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
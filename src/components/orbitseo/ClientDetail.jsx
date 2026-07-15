import { useState } from "react";
import { ArrowLeft, Globe, MapPin, Plus, Check, X, Pencil, Trash2, ExternalLink, CheckSquare, Square, Save, Wand2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TABS = ["Overview", "Strategy", "Blog", "GBP", "Notes & Tasks"];

const BLOG_FREQUENCIES = ["2x per month", "4x per month", "6x per month", "8x per month", "10x per month", "12x per month"];
const WEEKDAYS = [
  { num: 1, label: "Mon" },
  { num: 2, label: "Tue" },
  { num: 3, label: "Wed" },
  { num: 4, label: "Thu" },
  { num: 5, label: "Fri" },
  { num: 6, label: "Sat" },
  { num: 0, label: "Sun" },
];

function TextareaField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-orange-500/30 transition-colors"
      />
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30 transition-colors"
      />
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
      <h3 className="text-white font-bold text-xs tracking-[0.18em] uppercase">{title}</h3>
      {children}
    </div>
  );
}

export default function ClientDetail({ client, onBack, onUpdate }) {
  const [tab, setTab] = useState("Overview");
  const [form, setForm] = useState({ ...client });
  const [saving, setSaving] = useState(false);
  const [newBlog, setNewBlog] = useState({ topic: "", publishDate: "", status: "Planned", url: "" });
  const [addingBlog, setAddingBlog] = useState(false);
  const [newPost, setNewPost] = useState({ idea: "", dueDate: "", done: false });
  const [addingPost, setAddingPost] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [strategyBrief, setStrategyBrief] = useState("");
  const [showBriefInput, setShowBriefInput] = useState(false);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const updateNested = (key, subkey, val) => setForm((f) => ({ ...f, [key]: { ...(f[key] || {}), [subkey]: val } }));

  const toggleBlogDay = (num) => {
    const days = form.blogDays || [];
    update("blogDays", days.includes(num) ? days.filter((d) => d !== num) : [...days, num]);
  };

  const save = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...fields } = form;
    await base44.entities.OrbitSEOClient.update(client.id, fields);
    onUpdate({ ...client, ...fields });
    setSaving(false);
  };

  const addBlog = async () => {
    if (!newBlog.topic.trim()) return;
    const blogs = [...(form.blogs || []), { ...newBlog, id: Date.now() }];
    setForm((f) => ({ ...f, blogs }));
    await base44.entities.OrbitSEOClient.update(client.id, { blogs });
    setNewBlog({ topic: "", publishDate: "", status: "Planned", url: "" });
    setAddingBlog(false);
  };

  const toggleBlogStatus = async (id) => {
    const blogs = (form.blogs || []).map((b) =>
      b.id === id ? { ...b, status: b.status === "Published" ? "Planned" : "Published" } : b
    );
    setForm((f) => ({ ...f, blogs }));
    await base44.entities.OrbitSEOClient.update(client.id, { blogs });
  };

  const deleteBlog = async (id) => {
    const blogs = (form.blogs || []).filter((b) => b.id !== id);
    setForm((f) => ({ ...f, blogs }));
    await base44.entities.OrbitSEOClient.update(client.id, { blogs });
  };

  const addPost = async () => {
    if (!newPost.idea.trim()) return;
    const gbpPosts = [...(form.gbpPosts || []), { ...newPost, id: Date.now() }];
    setForm((f) => ({ ...f, gbpPosts }));
    await base44.entities.OrbitSEOClient.update(client.id, { gbpPosts });
    setNewPost({ idea: "", dueDate: "", done: false });
    setAddingPost(false);
  };

  const togglePost = async (id) => {
    const gbpPosts = (form.gbpPosts || []).map((p) => p.id === id ? { ...p, done: !p.done } : p);
    setForm((f) => ({ ...f, gbpPosts }));
    await base44.entities.OrbitSEOClient.update(client.id, { gbpPosts });
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const tasks = [...(form.tasks || []), { id: Date.now(), text: newTask.trim(), done: false }];
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.OrbitSEOClient.update(client.id, { tasks });
    setNewTask("");
    setAddingTask(false);
  };

  const toggleTask = async (id) => {
    const tasks = (form.tasks || []).map((t) => t.id === id ? { ...t, done: !t.done } : t);
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.OrbitSEOClient.update(client.id, { tasks });
  };

  const deleteTask = async (id) => {
    const tasks = (form.tasks || []).filter((t) => t.id !== id);
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.OrbitSEOClient.update(client.id, { tasks });
  };

  const generateStrategy = async () => {
    if (!strategyBrief.trim()) return;
    setGeneratingStrategy(true);
    const prompt = `You are an expert SEO strategist. Based on the following business description, generate a comprehensive SEO strategy.

Business: ${form.businessName}
Service Type: ${form.serviceType} SEO
Primary Location: ${form.primaryLocation || "Not specified"}
Service Locations: ${form.serviceLocations || "Not specified"}
What they sell / core services: ${form.offerPositioning?.services || "Not specified"}
Target audience: ${form.offerPositioning?.targetAudience || "Not specified"}
Geographic target: ${form.offerPositioning?.geoTarget || "Not specified"}
Problems they solve: ${form.problemSolution?.problems || "Not specified"}
Brief / Goals: ${strategyBrief}

Return a JSON with exactly these fields (no extra text):
{
  "primaryKeywords": "5-8 primary keyword phrases they should rank for, comma-separated",
  "secondaryKeywords": "secondary keyword clusters and variations, comma-separated",
  "serviceKeywords": "service-specific keywords (e.g. 'emergency plumber', 'HVAC repair'), comma-separated",
  "locationKeywords": "location-based keywords (city + service combos), comma-separated",
  "contentStrategy": "3-4 sentences describing the overall content approach, blog themes, and content pillars",
  "rankingGoals": "specific ranking goals for the next 3-6 months (e.g. page 1 for X keyword in X city)"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          primaryKeywords: { type: "string" },
          secondaryKeywords: { type: "string" },
          serviceKeywords: { type: "string" },
          locationKeywords: { type: "string" },
          contentStrategy: { type: "string" },
          rankingGoals: { type: "string" }
        }
      }
    });

    setForm((f) => ({
      ...f,
      seoStrategy: {
        ...(f.seoStrategy || {}),
        primaryKeywords: result.primaryKeywords || "",
        secondaryKeywords: result.secondaryKeywords || "",
        serviceKeywords: result.serviceKeywords || "",
        locationKeywords: result.locationKeywords || "",
        contentStrategy: result.contentStrategy || "",
        rankingGoals: result.rankingGoals || "",
      }
    }));

    setGeneratingStrategy(false);
    setShowBriefInput(false);
    setStrategyBrief("");
  };

  const blogStatusColor = { Planned: "bg-blue-500/10 text-blue-400", "In Progress": "bg-orange-500/10 text-orange-400", Published: "bg-green-500/10 text-green-400" };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-white/15">/</span>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-orange-500/60 text-sm font-bold">
              {form.businessName?.charAt(0)}
            </div>
            <span className="text-white font-bold text-sm">{form.businessName}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
              form.status === "Active" ? "bg-green-500/10 text-green-400" :
              form.status === "Paused" ? "bg-white/5 text-white/30" :
              "bg-orange-500/10 text-orange-400"
            }`}>{form.status}</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{form.serviceType}</span>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-4">
        <div className="flex gap-1 border-b border-white/[0.05] pb-0">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
                tab === t
                  ? "text-orange-500 border-orange-500"
                  : "text-white/30 hover:text-white/60 border-transparent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">

        {/* OVERVIEW TAB */}
        {tab === "Overview" && (
          <>
            <div className="grid grid-cols-2 gap-5">
              <SectionCard title="Business Overview">
                <InputField label="Business Name" value={form.businessName} onChange={(v) => update("businessName", v)} />
                <InputField label="Website" value={form.website} onChange={(v) => update("website", v)} />
                <InputField label="Primary Location" value={form.primaryLocation} onChange={(v) => update("primaryLocation", v)} />
                <InputField label="Service Locations" value={form.serviceLocations} onChange={(v) => update("serviceLocations", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Service Type</label>
                    <select value={form.serviceType || "Local"} onChange={(e) => update("serviceType", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                      {["Local", "National", "International"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Status</label>
                    <select value={form.status || "Active"} onChange={(e) => update("status", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                      {["Active", "Needs Attention", "Paused"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Offer & Positioning">
                <TextareaField label="What they sell / core services" value={form.offerPositioning?.services} onChange={(v) => updateNested("offerPositioning", "services", v)} />
                <TextareaField label="Target audience / ideal customer" value={form.offerPositioning?.targetAudience} onChange={(v) => updateNested("offerPositioning", "targetAudience", v)} />
                <InputField label="Geographic target" value={form.offerPositioning?.geoTarget} onChange={(v) => updateNested("offerPositioning", "geoTarget", v)} />
                <InputField label="Pricing positioning" value={form.offerPositioning?.pricing} onChange={(v) => updateNested("offerPositioning", "pricing", v)} placeholder="e.g. Premium, Budget, Mid-market" />
              </SectionCard>
            </div>

            <SectionCard title="Problem / Solution">
              <div className="grid grid-cols-3 gap-4">
                <TextareaField label="Problems they solve" value={form.problemSolution?.problems} onChange={(v) => updateNested("problemSolution", "problems", v)} />
                <TextareaField label="Customer pain points" value={form.problemSolution?.painPoints} onChange={(v) => updateNested("problemSolution", "painPoints", v)} />
                <TextareaField label="Key outcomes & value proposition" value={form.problemSolution?.outcomes} onChange={(v) => updateNested("problemSolution", "outcomes", v)} />
              </div>
            </SectionCard>
          </>
        )}

        {/* STRATEGY TAB */}
        {tab === "Strategy" && (
          <>
            <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-xs tracking-[0.18em] uppercase">SEO Strategy Overview</h3>
                <button
                  onClick={() => setShowBriefInput(!showBriefInput)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-xs font-semibold rounded-lg transition-all"
                >
                  <Wand2 className="w-3.5 h-3.5" />AI Generate Strategy
                </button>
              </div>

              {showBriefInput && (
                <div className="bg-purple-500/[0.05] border border-purple-500/15 rounded-xl p-4 space-y-3">
                  <p className="text-purple-300/70 text-xs">Describe what this business does, what they want to achieve, who their customers are, and any key goals. Claude will fill in the entire strategy.</p>
                  <textarea
                    autoFocus
                    value={strategyBrief}
                    onChange={(e) => setStrategyBrief(e.target.value)}
                    rows={4}
                    placeholder="e.g. Local HVAC company in Phoenix serving homeowners, wants to rank for emergency AC repair, competing with 3 large companies, goal is top 3 rankings in Phoenix + Scottsdale for main service keywords..."
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none resize-none focus:border-purple-500/30 transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={generateStrategy}
                      disabled={generatingStrategy || !strategyBrief.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      {generatingStrategy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</> : <><Wand2 className="w-3.5 h-3.5" />Generate Now</>}
                    </button>
                    <button onClick={() => { setShowBriefInput(false); setStrategyBrief(""); }} className="px-3 py-2 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <TextareaField label="Primary keyword focus" value={form.seoStrategy?.primaryKeywords} onChange={(v) => updateNested("seoStrategy", "primaryKeywords", v)} />
                <TextareaField label="Secondary keyword clusters" value={form.seoStrategy?.secondaryKeywords} onChange={(v) => updateNested("seoStrategy", "secondaryKeywords", v)} />
                <TextareaField label="Service-based keywords" value={form.seoStrategy?.serviceKeywords} onChange={(v) => updateNested("seoStrategy", "serviceKeywords", v)} />
                <TextareaField label="Location-based keywords" value={form.seoStrategy?.locationKeywords} onChange={(v) => updateNested("seoStrategy", "locationKeywords", v)} />
                <TextareaField label="Content strategy notes" value={form.seoStrategy?.contentStrategy} onChange={(v) => updateNested("seoStrategy", "contentStrategy", v)} />
                <TextareaField label="Ranking goals" value={form.seoStrategy?.rankingGoals} onChange={(v) => updateNested("seoStrategy", "rankingGoals", v)} />
              </div>
            </div>

            <SectionCard title="Performance Snapshot">
              <div className="grid grid-cols-2 gap-4">
                <TextareaField label="Traffic trend / notes" value={form.seoStrategy?.trafficTrend} onChange={(v) => updateNested("seoStrategy", "trafficTrend", v)} />
                <TextareaField label="Keyword movement observations" value={form.seoStrategy?.keywordMovement} onChange={(v) => updateNested("seoStrategy", "keywordMovement", v)} />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-white/[0.02] rounded-lg border border-white/[0.04] p-4 text-center">
                  <p className="text-orange-500 text-2xl font-bold">{form.blogsPublishedCount || 0}</p>
                  <p className="text-white/30 text-xs mt-1">Blogs Published</p>
                </div>
                <div className="bg-white/[0.02] rounded-lg border border-white/[0.04] p-4 text-center">
                  <p className="text-green-400 text-2xl font-bold">{form.gbpPostsDoneCount || 0}</p>
                  <p className="text-white/30 text-xs mt-1">GBP Posts Done</p>
                </div>
              </div>
            </SectionCard>
          </>
        )}

        {/* BLOG TAB */}
        {tab === "Blog" && (
          <SectionCard title="Blog Management">
            <div className="pb-4 border-b border-white/[0.05] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Blog Frequency</label>
                  <select value={form.blogFrequency || ""} onChange={(e) => update("blogFrequency", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                    <option value="">— Select frequency —</option>
                    {BLOG_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Next Blog Due Date</label>
                  <input type="date" value={form.nextBlogDue || ""} onChange={(e) => update("nextBlogDue", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none" />
                  <p className="text-white/25 text-[10px] mt-1">Syncs to Google Calendar when you click "Sync to Calendar".</p>
                </div>
              </div>
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-2">Days of the Week · Blogs Done</label>
                <div className="flex gap-2 flex-wrap">
                  {WEEKDAYS.map((d) => {
                    const selected = (form.blogDays || []).includes(d.num);
                    return (
                      <button key={d.num} type="button" onClick={() => toggleBlogDay(d.num)} className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${selected ? "bg-orange-500/15 border-orange-500/30 text-orange-400" : "bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/15"}`}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-white/25 text-[10px] mt-2">These tasks reset weekly on your dashboard on the selected days. GBP posts auto-match.</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Blog Topics</h4>
              <button onClick={() => setAddingBlog(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs transition-colors">
                <Plus className="w-3.5 h-3.5" />Add Blog
              </button>
            </div>

            {addingBlog && (
              <div className="bg-white/[0.02] border border-orange-500/15 rounded-lg p-4 space-y-3 mb-3">
                <input autoFocus value={newBlog.topic} onChange={(e) => setNewBlog({ ...newBlog, topic: e.target.value })} placeholder="Blog topic..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none" />
                <div className="flex gap-3">
                  <input type="date" value={newBlog.publishDate} onChange={(e) => setNewBlog({ ...newBlog, publishDate: e.target.value })} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white outline-none" />
                  <select value={newBlog.status} onChange={(e) => setNewBlog({ ...newBlog, status: e.target.value })} className="bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white outline-none">
                    {["Planned", "In Progress", "Published"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <input value={newBlog.url} onChange={(e) => setNewBlog({ ...newBlog, url: e.target.value })} placeholder="Published URL (optional)" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={addBlog} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors">Add</button>
                  <button onClick={() => setAddingBlog(false)} className="px-3 py-1.5 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {(form.blogs || []).length === 0 && <p className="text-white/20 text-xs text-center py-4">No blogs yet. Add your first topic above.</p>}
              {(form.blogs || []).map((blog) => (
                <div key={blog.id} className="flex items-center gap-3 py-3 px-4 bg-white/[0.02] rounded-lg border border-white/[0.04] group">
                  <button onClick={() => toggleBlogStatus(blog.id)} className="shrink-0">
                    {blog.status === "Published" ? <CheckSquare className="w-4 h-4 text-green-400/70" /> : <Square className="w-4 h-4 text-white/20" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${blog.status === "Published" ? "text-white/30 line-through" : "text-white/80"}`}>{blog.topic}</p>
                    {blog.publishDate && <p className="text-white/25 text-xs mt-0.5">Due: {new Date(blog.publishDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${blogStatusColor[blog.status] || "bg-white/5 text-white/30"}`}>{blog.status}</span>
                  {blog.url && <a href={blog.url} target="_blank" rel="noreferrer" className="text-white/20 hover:text-white/60 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  <button onClick={() => deleteBlog(blog.id)} className="p-1 text-white/10 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* GBP TAB */}
        {tab === "GBP" && (
          <SectionCard title="Google Business Profile">
            {form.serviceType === "International" ? (
              <>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-4 py-3 text-white/30 text-xs">
                  GBP posting is not applicable for international clients. Only Google Shop status is tracked below.
                </div>
                <div className="max-w-xs">
                  <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Google Shop Status</label>
                  <select value={form.googleShopStatus || ""} onChange={(e) => update("googleShopStatus", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                    <option value="">— Select —</option>
                    {["Active", "Needs Attention", "Not Applicable", "Paused"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/[0.05]">
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">GBP Status</label>
                    <select value={form.gbpStatus || "Active"} onChange={(e) => update("gbpStatus", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                      {["Active", "Needs Attention", "Not Applicable", "Paused"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Google Shop Status</label>
                    <select value={form.googleShopStatus || ""} onChange={(e) => update("googleShopStatus", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                      <option value="">— Select —</option>
                      {["Active", "Needs Attention", "Not Applicable", "Paused"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">GBP Frequency · Auto-matched to Blog</label>
                    <div className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-orange-400/80">
                      {form.gbpStatus === "Not Applicable" ? <span className="text-white/25">Not applicable</span> : (form.blogFrequency || <span className="text-white/25">Set blog frequency in the Blog tab</span>)}
                    </div>
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">Next GBP Post Due Date</label>
                    <input type="date" value={form.gbpNextDue || ""} onChange={(e) => update("gbpNextDue", e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <p className="text-white/25 text-[10px] mt-1">Syncs to Google Calendar when you click "Sync to Calendar".</p>
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">GBP Days · Auto-matched to Blog</label>
                    <div className="w-full min-h-[38px] bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm flex flex-wrap items-center gap-1.5">
                      {form.gbpStatus === "Not Applicable"
                        ? <span className="text-white/25">Not applicable</span>
                        : (form.blogDays || []).length === 0
                        ? <span className="text-white/25">Set blog days in the Blog tab</span>
                        : WEEKDAYS.filter((w) => (form.blogDays || []).includes(w.num)).map((w) => (
                            <span key={w.num} className="text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400/80 border border-orange-500/15">{w.label}</span>
                          ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white/60 text-xs font-semibold uppercase tracking-wider">Post Ideas & Tracking</h4>
                  <button onClick={() => setAddingPost(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs transition-colors">
                    <Plus className="w-3.5 h-3.5" />Add Post
                  </button>
                </div>

                {addingPost && (
                  <div className="bg-white/[0.02] border border-orange-500/15 rounded-lg p-4 space-y-3 mb-3">
                    <input autoFocus value={newPost.idea} onChange={(e) => setNewPost({ ...newPost, idea: e.target.value })} placeholder="Post idea..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none" />
                    <div className="flex gap-3">
                      <input type="date" value={newPost.dueDate} onChange={(e) => setNewPost({ ...newPost, dueDate: e.target.value })} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-sm text-white outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addPost} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors">Add</button>
                      <button onClick={() => setAddingPost(false)} className="px-3 py-1.5 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(form.gbpPosts || []).length === 0 && <p className="text-white/20 text-xs text-center py-4">No GBP posts tracked yet.</p>}
                  {(form.gbpPosts || []).map((post) => (
                    <div key={post.id} className="flex items-center gap-3 py-3 px-4 bg-white/[0.02] rounded-lg border border-white/[0.04] group">
                      <button onClick={() => togglePost(post.id)} className="shrink-0">
                        {post.done ? <CheckSquare className="w-4 h-4 text-green-400/70" /> : <Square className="w-4 h-4 text-white/20" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${post.done ? "text-white/30 line-through" : "text-white/80"}`}>{post.idea}</p>
                        {post.dueDate && <p className="text-white/25 text-xs mt-0.5">Due: {new Date(post.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>}
                      </div>
                      {post.done && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-400">Done</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        )}

        {/* NOTES & TASKS TAB */}
        {tab === "Notes & Tasks" && (
          <div className="grid grid-cols-2 gap-5">
            <SectionCard title="SEO Notes & Strategy">
              <TextareaField label="SEO Notes" value={form.notes} onChange={(v) => update("notes", v)} />
              <TextareaField label="Content ideas" value={form.seoStrategy?.contentIdeas} onChange={(v) => updateNested("seoStrategy", "contentIdeas", v)} />
              <TextareaField label="Strategy adjustments / observations" value={form.seoStrategy?.adjustments} onChange={(v) => updateNested("seoStrategy", "adjustments", v)} />
            </SectionCard>

            <SectionCard title="Action Items">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/30 text-xs">{(form.tasks || []).filter(t => !t.done).length} remaining</span>
                <button onClick={() => setAddingTask(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs transition-colors">
                  <Plus className="w-3.5 h-3.5" />Add Task
                </button>
              </div>

              {addingTask && (
                <div className="flex items-center gap-2 mb-3">
                  <input autoFocus value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); if (e.key === "Escape") setAddingTask(false); }} placeholder="New task..." className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-1.5 text-sm text-white placeholder:text-white/20 outline-none" />
                  <button onClick={addTask} className="p-1.5 text-green-400/70 hover:text-green-400"><Check className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setAddingTask(false)} className="p-1.5 text-white/30 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <div className="space-y-1.5">
                {(form.tasks || []).length === 0 && <p className="text-white/20 text-xs text-center py-4">No tasks yet.</p>}
                {(form.tasks || []).map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 group py-1">
                    <button onClick={() => toggleTask(task.id)} className="shrink-0 text-white/20 hover:text-orange-500/70 transition-colors">
                      {task.done ? <CheckSquare className="w-4 h-4 text-green-400/70" /> : <Square className="w-4 h-4" />}
                    </button>
                    <span className={`flex-1 text-sm ${task.done ? "line-through text-white/25" : "text-white/70"}`}>{task.text}</span>
                    <button onClick={() => deleteTask(task.id)} className="p-0.5 text-white/10 hover:text-red-400/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Settings, X, Plus, ChevronRight } from "lucide-react";
import PageHeader from "../components/PageHeader";
import QuickAddLead from "@/features/build/QuickAddLead";
import ErrorBoundary from "@/components/ErrorBoundary";
import ClientContentSchedule from "../components/dashboard/ClientContentSchedule";
import ActiveSubscriptions from "../components/dashboard/ActiveSubscriptions";
import FinancialPanel from "../components/dashboard/FinancialPanel";
import PriorityTasks from "../components/dashboard/PriorityTasks";
import CommandBriefing from "../components/dashboard/CommandBriefing";
import ProjectProgressDashboard from "../components/ProjectProgressDashboard";
import MinusculeProjects from "../components/dashboard/MinusculeProjects";
import ProjectionWidget from "../components/dashboard/ProjectionWidget";
import LiveOps, { ClientHealthStrip } from "@/features/mission/LiveOps";
import FocusWidget from "@/features/mission/FocusWidget";
import PackagesStrip from "@/features/packages/components/PackagesStrip";
import RevenueStrip from "@/features/packages/components/RevenueStrip";
import { TILE_WIDGETS } from "@/features/mission/widgets";

// group: "core" = full-width Mission Control strips · "tile" = new widgets (pack into a grid) · "legacy" = old-app widgets
const ALL_WIDGETS = [
  { id: "revenue", group: "core", label: "Revenue + subscriptions (live from Stripe)" },
  { id: "packages", group: "core", label: "Subscriptions + packages board (per client orbs)" },
  { id: "live-ops", group: "core", label: "Live Operations (feed, automations, requests)" },
  { id: "client-health", group: "core", label: "Client cards (automations, requests, work this month)" },
  { id: "focus", group: "core", label: "Focus now + Next up (task engine)" },
  ...TILE_WIDGETS.map((w) => ({ id: w.id, group: "tile", label: w.label, desc: w.desc })),
  { id: "priority", group: "legacy", label: "Priority Tasks (old To-Do list)" },
  { id: "content-schedule", group: "legacy", label: "HyperCare+ posting schedule" },
  { id: "subscriptions", group: "legacy", label: "Active Subscriptions" },
  { id: "financial", group: "legacy", label: "Financial Panel + Plan to Execute" },
  { id: "projections", group: "legacy", label: "Revenue Projections" },
  { id: "project-progress", group: "legacy", label: "Project Progress (WebOps)" },
  { id: "minuscule-projects", group: "legacy", label: "Minuscule Projects" },
];
const byId = Object.fromEntries(ALL_WIDGETS.map((w) => [w.id, w]));

const DEFAULT_ACTIVE = ["revenue", "live-ops", "focus"];

const STORAGE_KEY = "dashboard_widget_order_v7";

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.filter((id) => byId[id]);
  } catch { /* ignore */ }
  return DEFAULT_ACTIVE;
}

function saveOrder(order) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch { /* ignore */ }
}

function WidgetRenderer({ id }) {
  switch (id) {
    case "revenue": return <RevenueStrip />;
    case "packages": return <PackagesStrip />;
    case "live-ops": return <LiveOps />;
    case "client-health": return <ClientHealthStrip />;
    case "focus": return <FocusWidget />;
    case "priority": return <PriorityTasks />;
    case "content-schedule": return <ClientContentSchedule />;
    case "subscriptions": return <div className="px-8 pt-6"><ActiveSubscriptions /></div>;
    case "financial": return <div className="px-8 pt-6"><FinancialPanel /></div>;
    case "projections": return <div className="px-8 pt-6"><ProjectionWidget /></div>;
    case "project-progress": return <ProjectProgressDashboard />;
    case "minuscule-projects": return <MinusculeProjects />;
    default: {
      const tile = TILE_WIDGETS.find((w) => w.id === id);
      return tile ? <tile.Component /> : null;
    }
  }
}

// Consecutive tiles share one responsive grid; strips stay full width.
function layoutRuns(order) {
  const runs = [];
  order.forEach((id) => {
    const isTile = byId[id]?.group === "tile";
    const last = runs[runs.length - 1];
    if (isTile && last && last.tiles) last.ids.push(id);
    else runs.push({ tiles: isTile, ids: [id] });
  });
  return runs;
}

function AddRow({ widget, onAdd }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-dashed border-ink/[0.13] bg-ink/[0.02] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink/70">{widget.label}</p>
        {widget.desc && <p className="truncate text-[11.5px] text-ink/45">{widget.desc}</p>}
      </div>
      <button
        onClick={() => onAdd(widget.id)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-500/15 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-500/70 transition-all hover:bg-orange-500/20 hover:text-orange-500"
      >
        <Plus className="h-3.5 w-3.5" />Add
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [order, setOrder] = useState(loadOrder);
  const [editing, setEditing] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);

  const commit = (next) => { setOrder(next); saveOrder(next); };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(order);
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    commit(next);
  };

  const removeWidget = (id) => commit(order.filter((w) => w !== id));
  const addWidget = (id) => commit([...order, id]);
  const addAllTiles = () => commit([...order, ...TILE_WIDGETS.map((w) => w.id).filter((id) => !order.includes(id))]);

  const available = ALL_WIDGETS.filter((w) => !order.includes(w.id));
  const availCore = available.filter((w) => w.group === "core");
  const availTiles = available.filter((w) => w.group === "tile");
  const availLegacy = available.filter((w) => w.group === "legacy");

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command / Mission Control" rightText="Everything, live">
        <button
          onClick={() => setEditing(!editing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            editing
              ? "bg-orange-500/15 text-orange-500 border-orange-500/20"
              : "text-ink/[0.48] hover:text-ink/60 border-ink/[0.13] hover:border-ink/20"
          }`}
        >
          {editing ? <><X className="w-3.5 h-3.5" />Done</> : <><Settings className="w-3.5 h-3.5" />Customize</>}
        </button>
      </PageHeader>
      {/* Build Engine: the quick-add lead bar is pinned on top in classic mode too. */}
      <div className="px-4 pt-4 md:px-8"><ErrorBoundary compact where="quick-add lead"><QuickAddLead /></ErrorBoundary></div>

      {editing ? (
        <div className="space-y-8 px-5 py-3 md:px-8">
          <div>
            <p className="mono-label mb-1 text-[9.5px] text-ink/50">On your dashboard</p>
            <p className="mb-3 text-xs text-ink/[0.48]">Drag to reorder. Tiles next to each other pack into a grid.</p>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="dashboard-widgets">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {order.map((id, index) => {
                      const widget = byId[id];
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`flex items-center gap-3 px-4 py-3 rounded-md border transition-all ${
                                snapshot.isDragging ? "bg-orange-500/10 border-orange-500/30 shadow-lg" : "bg-card border-ink/[0.13]"
                              }`}
                            >
                              <span {...drag.dragHandleProps} className="cursor-grab text-ink/[0.38] hover:text-ink/50 active:cursor-grabbing">
                                <GripVertical className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 truncate text-sm font-medium text-ink/70">{widget?.label}</span>
                              <span className={`mono-label shrink-0 px-1.5 py-0.5 text-[8.5px] ${widget?.group === "tile" ? "bg-[#ff3c00]/10 text-[#ff3c00]" : widget?.group === "legacy" ? "bg-ink/[0.06] text-ink/45" : "border border-hair text-ink/50"}`}>
                                {widget?.group === "tile" ? "Tile" : widget?.group === "legacy" ? "Legacy" : "Strip"}
                              </span>
                              <span className="ml-auto text-xs text-ink/[0.38]">#{index + 1}</span>
                              <button onClick={() => removeWidget(id)} className="p-1 text-ink/[0.38] transition-colors hover:text-red-600/70">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {order.length === 0 && <p className="py-4 text-center text-xs text-ink/[0.38]">No widgets on your dashboard. Add some below.</p>}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {availTiles.length > 0 && (
            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="mono-label text-[9.5px] text-[#ff3c00]">New · Mission tiles</p>
                  <p className="text-xs text-ink/[0.48]">Live from tasks, projects, Claude, clients, Stripe and the clock.</p>
                </div>
                {availTiles.length > 1 && (
                  <button onClick={addAllTiles} className="mono-label shrink-0 text-[9.5px] text-ink/50 hover:text-[#ff3c00]">Add all →</button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {availTiles.map((w) => <AddRow key={w.id} widget={w} onAdd={addWidget} />)}
              </div>
            </div>
          )}

          {availCore.length > 0 && (
            <div>
              <p className="mono-label mb-3 text-[9.5px] text-ink/50">Mission Control strips</p>
              <div className="grid gap-2 md:grid-cols-2">
                {availCore.map((w) => <AddRow key={w.id} widget={w} onAdd={addWidget} />)}
              </div>
            </div>
          )}

          {availLegacy.length > 0 && (
            <div>
              <button onClick={() => setLegacyOpen(!legacyOpen)} className="mono-label flex items-center gap-1.5 text-[9.5px] text-ink/45 hover:text-ink/70">
                <ChevronRight className={`h-3 w-3 transition-transform ${legacyOpen ? "rotate-90" : ""}`} />
                Legacy · {availLegacy.length} from the old app
              </button>
              {legacyOpen && (
                <>
                  <p className="mb-3 mt-2 text-xs text-ink/[0.48]">These read the old to-do, WebOps and Forge data. Kept so nothing is lost; the tiles above replace them.</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {availLegacy.map((w) => <AddRow key={w.id} widget={w} onAdd={addWidget} />)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="pb-8">
          <CommandBriefing />
          {layoutRuns(order).map((run) =>
            run.tiles ? (
              <div key={run.ids.join("|")} className="grid gap-4 px-5 pt-6 md:grid-cols-2 md:px-8 xl:grid-cols-3">
                {run.ids.map((id) => <WidgetRenderer key={id} id={id} />)}
              </div>
            ) : (
              <div key={run.ids[0]}>
                <WidgetRenderer id={run.ids[0]} />
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

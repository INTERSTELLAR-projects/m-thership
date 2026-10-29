import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Settings, X, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ClientContentSchedule from "../components/dashboard/ClientContentSchedule";
import ActiveSubscriptions from "../components/dashboard/ActiveSubscriptions";
import FinancialPanel from "../components/dashboard/FinancialPanel";
import PriorityTasks from "../components/dashboard/PriorityTasks";
import DailyBriefing from "../components/dashboard/DailyBriefing";
import ProjectProgressDashboard from "../components/ProjectProgressDashboard";
import MinusculeProjects from "../components/dashboard/MinusculeProjects";
import ProjectionWidget from "../components/dashboard/ProjectionWidget";

const ALL_WIDGETS = [
  { id: "priority", label: "Priority Tasks" },
  { id: "content-schedule", label: "Client Content Schedule" },
  { id: "subscriptions", label: "Active Subscriptions" },
  { id: "financial", label: "Financial Panel" },
  { id: "projections", label: "Revenue Projections" },
  { id: "project-progress", label: "Project Progress" },
  { id: "minuscule-projects", label: "Minuscule Projects" },
];

const DEFAULT_ACTIVE = ["priority", "content-schedule", "subscriptions", "financial"];

const STORAGE_KEY = "dashboard_widget_order_v3";

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.every((id) => ALL_WIDGETS.some((w) => w.id === id))) return saved;
  } catch {}
  return DEFAULT_ACTIVE;
}

function saveOrder(order) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

function WidgetRenderer({ id }) {
  switch (id) {
    case "priority": return <PriorityTasks />;
    case "content-schedule": return <ClientContentSchedule />;
    case "subscriptions": return <div className="px-8 pt-6"><ActiveSubscriptions /></div>;
    case "financial": return <div className="px-8 pt-6"><FinancialPanel /></div>;
    case "projections": return <div className="px-8 pt-6"><ProjectionWidget /></div>;
    case "project-progress": return <ProjectProgressDashboard />;
    case "minuscule-projects": return <MinusculeProjects />;
    default: return null;
  }
}

export default function Dashboard() {
  const [order, setOrder] = useState(loadOrder);
  const [editing, setEditing] = useState(false);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const next = Array.from(order);
    const [removed] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, removed);
    setOrder(next);
    saveOrder(next);
  };

  const removeWidget = (id) => {
    const next = order.filter((w) => w !== id);
    setOrder(next);
    saveOrder(next);
  };

  const addWidget = (id) => {
    const next = [...order, id];
    setOrder(next);
    saveOrder(next);
  };

  const availableToAdd = ALL_WIDGETS.filter((w) => !order.includes(w.id));

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between pr-8">
        <PageHeader breadcrumb="Command / Mission Control" rightText="Everything, live" />
        <div className="flex items-center gap-3">
          <DailyBriefing />
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
        </div>
      </div>

      {editing ? (
        <div className="px-8 py-3 space-y-6">
          <div>
            <p className="text-ink/[0.48] text-xs mb-3">Drag widgets to reorder them, or remove ones you don't want.</p>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="dashboard-widgets">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {order.map((id, index) => {
                      const widget = ALL_WIDGETS.find((w) => w.id === id);
                      return (
                        <Draggable key={id} draggableId={id} index={index}>
                          {(drag, snapshot) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className={`flex items-center gap-3 px-4 py-3 rounded-md border transition-all ${
                                snapshot.isDragging
                                  ? "bg-orange-500/10 border-orange-500/30 shadow-lg"
                                  : "bg-card border-ink/[0.13]"
                              }`}
                            >
                              <span {...drag.dragHandleProps} className="text-ink/[0.38] hover:text-ink/50 cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                              </span>
                              <span className="text-ink/70 text-sm font-medium">{widget?.label}</span>
                              <span className="ml-auto text-ink/[0.38] text-xs">#{index + 1}</span>
                              <button
                                onClick={() => removeWidget(id)}
                                className="p-1 text-ink/[0.38] hover:text-red-600/70 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                    {order.length === 0 && (
                      <p className="text-ink/[0.38] text-xs py-4 text-center">No widgets on your dashboard. Add some below.</p>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {availableToAdd.length > 0 && (
            <div>
              <p className="text-ink/[0.48] text-xs mb-3">Add a widget to your dashboard.</p>
              <div className="space-y-2">
                {availableToAdd.map((widget) => (
                  <div key={widget.id} className="flex items-center gap-3 px-4 py-3 rounded-md border border-dashed border-ink/[0.13] bg-ink/[0.02]">
                    <span className="text-ink/50 text-sm font-medium">{widget.label}</span>
                    <button
                      onClick={() => addWidget(widget.id)}
                      className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500/70 hover:text-orange-500 text-xs font-medium rounded-lg border border-orange-500/15 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="pb-8">
          {order.map((id) => (
            <div key={id}>
              <WidgetRenderer id={id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
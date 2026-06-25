import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Settings, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import ClientContentSchedule from "../components/dashboard/ClientContentSchedule";
import ClientOperations from "../components/dashboard/ClientOperations";
import ActiveSubscriptions from "../components/dashboard/ActiveSubscriptions";
import FinancialPanel from "../components/dashboard/FinancialPanel";
import PriorityTasks from "../components/dashboard/PriorityTasks";
import DailyBriefing from "../components/dashboard/DailyBriefing";

const DEFAULT_WIDGETS = [
  { id: "priority", label: "Priority Tasks" },
  { id: "content-schedule", label: "Client Content Schedule" },
  { id: "client-ops", label: "Client Operations" },
  { id: "subscriptions", label: "Active Subscriptions" },
  { id: "financial", label: "Financial Panel" },
];

const STORAGE_KEY = "dashboard_widget_order_v2";

function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === DEFAULT_WIDGETS.length) return saved;
  } catch {}
  return DEFAULT_WIDGETS.map((w) => w.id);
}

function saveOrder(order) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

function WidgetRenderer({ id }) {
  switch (id) {
    case "priority": return <PriorityTasks />;
    case "content-schedule": return <ClientContentSchedule />;
    case "client-ops": return <ClientOperations />;
    case "subscriptions": return <div className="px-8 pt-6"><ActiveSubscriptions /></div>;
    case "financial": return <div className="px-8 pt-6"><FinancialPanel /></div>;
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

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between pr-8">
        <PageHeader breadcrumb="Command Center / Dashboard" />
        <div className="flex items-center gap-3">
          <DailyBriefing />
          <button
          onClick={() => setEditing(!editing)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            editing
              ? "bg-orange-500/15 text-orange-500 border-orange-500/20"
              : "text-white/30 hover:text-white/60 border-white/10 hover:border-white/20"
          }`}
        >
          {editing ? <><X className="w-3.5 h-3.5" />Done</> : <><Settings className="w-3.5 h-3.5" />Customize</>}
        </button>
        </div>
      </div>

      {editing ? (
        <div className="px-8 py-3">
          <p className="text-white/30 text-xs mb-3">Drag widgets to reorder them on your dashboard.</p>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="dashboard-widgets">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {order.map((id, index) => {
                    const widget = DEFAULT_WIDGETS.find((w) => w.id === id);
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                              snapshot.isDragging
                                ? "bg-orange-500/10 border-orange-500/30 shadow-lg"
                                : "bg-card border-white/[0.06]"
                            }`}
                          >
                            <span {...drag.dragHandleProps} className="text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <span className="text-white/70 text-sm font-medium">{widget?.label}</span>
                            <span className="ml-auto text-white/20 text-xs">#{index + 1}</span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
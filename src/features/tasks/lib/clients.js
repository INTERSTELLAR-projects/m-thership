import { base44 } from "@/api/base44Client";

// The target app's client entity is CRMClient. Task components expect { id, name },
// so every client row is normalised with name = business.
export const normalizeClient = (c) => ({ ...c, name: c.business || c.name || "" });

export async function fetchClients() {
  try {
    const page = await base44.entities.CRMClient.list({ sort: "business", limit: 300 });
    const rows = Array.isArray(page) ? page : (page && page.items) || [];
    return rows.map(normalizeClient);
  } catch (error) {
    return [];
  }
}

export const itemsOf = (page) => (Array.isArray(page) ? page : (page && page.items) || []);

// Fired after voice commands or bulk changes so open task views can reload.
export const TASKS_CHANGED = "mothership:tasks-changed";
export const emitTasksChanged = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TASKS_CHANGED));
};

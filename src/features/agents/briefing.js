// Command Briefing item for the Agent Constellation: today's CEO brief headline plus what needs Justin.
// Facts only, read from the current records; returns null when there is nothing on record yet.
import { base44 } from "@/api/base44Client";

const arr = (p) => Promise.resolve(p).then((r) => (Array.isArray(r) ? r : (r && r.items) || [])).catch(() => []);

export async function loadAgentsBriefing() {
  if (!base44.entities.CeoBrief) return null;
  const [briefs, broken, learnings, brains] = await Promise.all([
    arr(base44.entities.CeoBrief.filter({ scope: "interstellar" }, "-generated_at", 1)),
    arr(base44.entities.AgentRegistry.filter({ status: "broken" }, "name", 50)),
    arr(base44.entities.AgentLearning.filter({ status: "proposed" }, "-created_date", 100)),
    arr(base44.entities.BusinessBrain.list("-updated_date", 300)),
  ]);
  const brief = briefs[0] || null;
  const conflicts = brains.reduce((n, b) => n + (b.conflicts || []).filter((c) => c.status === "open").length, 0);
  if (!brief && !broken.length && !learnings.length && !conflicts) return null;
  return {
    brief,
    broken: broken.map((a) => ({ key: a.key, name: a.name, client: a.client_name || "" })),
    proposed: learnings.length,
    conflicts,
  };
}

// Present mode scenes, built only from live records: the agent registry (names, roles, triggers, status, runs,
// reads/writes), the Company Brain, the latest pillar scores and the open launch plan. Connecting sentences are
// fixed wording around those facts; no metric here is typed in by hand.
import { countStatus, investorize, firstSentence, flowAgents, nextActions, weakestPillars, runs30, PILLAR_NAMES, deptsForPillar, pillarOfAgent } from "../map/model";

// The order Justin walks investors through; departments missing from the data are skipped.
export const SCENE_DEPT_ORDER = ["command", "systems", "backoffice", "success", "delivery", "marketing", "sales", "research"];
const NOT_FOR_STAGE = /approval|one-time|\btest\b|\bseed\b|queue/i;

const list = (arr) => (arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);
const shortList = (arr, max = 3) => (arr.length <= max ? list(arr) : `${arr.slice(0, max).join(", ")} and ${arr.length - max} more`);

export function buildScenes({ registry, graph, handoffs, depts, hqBrain, scores, scoredOn, launchItems, ceoName, clients = [] }) {
  const hq = registry.filter((a) => a.scope === "interstellar");
  const byKey = new Map(hq.map((a) => [a.key, a]));
  const deptLabel = (k) => depts.find((d) => d.key === k)?.label || k;
  const scenes = [];

  // 1. Opening
  const c = countStatus(hq);
  const active = new Set(clients.map((x) => x.id));
  const inClients = registry.filter((a) => a.scope === "client" && a.status === "live" && (!active.size || active.has(a.client_id)));
  const clientCount = new Set(inClients.map((a) => a.client_id)).size;
  const deptCount = (graph.clusters || []).length;
  const busy = handoffs.filter((h) => byKey.get(h.from)?.status === "live" && byKey.get(h.to)?.status === "live" && h.fromDept !== h.toDept).slice(0, 14);
  scenes.push({
    id: "open", kind: "open", duration: 9000, camera: { type: "fit" },
    links: new Set(busy.map((h) => h.id)), lit: null,
    eyebrow: "Interstellar Strategies",
    title: ["Interstellar runs on an", "AI agent workforce."],
    counts: { live: c.live, paused: c.paused, planned: c.planned, broken: c.broken },
    lead: `${hq.length} agents across ${deptCount} departments, led by one Commander and sharing one Company Brain.`,
    foot: inClients.length ? `Plus ${inClients.length} agents live inside ${clientCount} client accounts.` : "",
  });

  // 2. The Commander
  const commander = byKey.get("commander");
  if (commander) {
    const reporting = hq.filter((a) => a.reports_to === "commander").length;
    const feeds = handoffs.filter((h) => h.to === "commander");
    const lit = new Set(["a:commander", "brain", ...feeds.map((h) => `a:${h.from}`)]);
    scenes.push({
      id: "commander", kind: "commander", duration: 10000, camera: { type: "nodes", ids: ["a:commander", "brain"], pad: 150, maxK: 1.5 },
      lit, links: new Set(feeds.map((h) => h.id)),
      eyebrow: "The CEO agent",
      title: [ceoName || commander.name],
      lead: firstSentence(commander.role.replace(/^The CEO agent\.\s*/i, ""), 220),
      facts: [
        ["Reports to", commander.reports_to === "justin" ? "Justin, founder" : investorize(commander.reports_to || "—")],
        ["Agents reporting in", String(reporting)],
        ["Feeding it directly", `${feeds.length} agent${feeds.length === 1 ? "" : "s"}`],
        ...((commander.writes_knowledge || []).includes("ceo_brief") ? [["Writes", "The daily CEO brief"]] : []),
      ],
    });
  }

  // 3. One scene per department
  const present = SCENE_DEPT_ORDER.filter((k) => hq.some((a) => a.department === k && a.key !== "commander"));
  present.forEach((k, i) => {
    const mine = hq.filter((a) => a.department === k && a.key !== "commander");
    const keys = new Set(mine.map((a) => a.key));
    const cc = countStatus(mine);
    const links = handoffs.filter((h) => keys.has(h.from) || keys.has(h.to)).slice(0, 28);
    const outD = [...new Set(handoffs.filter((h) => keys.has(h.from) && !keys.has(h.to)).map((h) => h.toDept))].filter((x) => x !== k);
    const inD = [...new Set(handoffs.filter((h) => keys.has(h.to) && !keys.has(h.from)).map((h) => h.fromDept))].filter((x) => x !== k);
    const lit = new Set([`d:${k}`, ...mine.map((a) => `a:${a.key}`), ...links.map((h) => `a:${h.from}`), ...links.map((h) => `a:${h.to}`)]);
    const onDuty = mine.filter((a) => a.status === "live" && !NOT_FOR_STAGE.test(`${a.name} ${a.schedule || ""} ${firstSentence(a.role, 400)}`)).sort((a, b) => runs30(b) - runs30(a) || (b.last_run_at ? 1 : 0) - (a.last_run_at ? 1 : 0)).slice(0, 3)
      .map((a) => ({ key: a.key, name: investorize(a.name), what: firstSentence(a.role, 150), when: investorize(a.schedule || "") }));
    const def = depts.find((d) => d.key === k);
    const bits = [];
    if (outD.length) bits.push(`hands work to ${shortList(outD.map(deptLabel))}`);
    if (inD.length) bits.push(`picks up work from ${shortList(inD.map(deptLabel))}`);
    const joined = bits.length ? `It ${bits.join(" and ")}.` : "Its agents report straight to the Commander.";
    scenes.push({
      id: `dept:${k}`, kind: "dept", dept: k, duration: 11000, camera: { type: "cluster", key: k },
      lit, links: new Set(links.map((h) => h.id)),
      eyebrow: `Department ${String(i + 1).padStart(2, "0")} of ${String(present.length).padStart(2, "0")}`,
      title: [deptLabel(k)],
      lead: investorize(def?.blurb || ""),
      counts: { live: cc.live, paused: cc.paused, planned: cc.planned, broken: cc.broken },
      onDuty,
      joined,
    });
  });

  // 3b. Company Brain
  const reads = hq.filter((a) => (a.reads_knowledge || []).some((s) => /^(brains?|businessbrain)\b/i.test(String(s).trim())));
  const writes = hq.filter((a) => (a.writes_knowledge || []).some((s) => /^(brains?|businessbrain)\b/i.test(String(s).trim())));
  const brainLinks = handoffs.filter((h) => h.via.includes("businessbrain"));
  scenes.push({
    id: "brain", kind: "brain", duration: 9000, camera: { type: "nodes", ids: ["brain", ...writes.map((a) => `a:${a.key}`), ...reads.map((a) => `a:${a.key}`)], pad: 80, maxK: 1.4 },
    lit: new Set(["brain", ...reads.map((a) => `a:${a.key}`), ...writes.map((a) => `a:${a.key}`)]), links: new Set(brainLinks.map((h) => h.id)),
    eyebrow: "Shared memory",
    title: ["Company Brain"],
    lead: "One memory for the whole company. Departments write what they learn into it, and agents read it before they act.",
    facts: [
      ["Agents writing to it", String(writes.length)],
      ["Agents reading from it", String(reads.length)],
      ...(hqBrain && Number.isFinite(Number(hqBrain.completeness)) ? [["Knowledge map filled in", `${Math.round(hqBrain.completeness)}%`]] : []),
    ],
  });

  // 4. How it works together
  const steps = flowAgents(hq);
  const chain = steps.map((s) => (s.live[0] || s.agents[0] || null));
  const flowLinks = [];
  for (let i = 0; i < chain.length - 1; i++) if (chain[i] && chain[i + 1]) flowLinks.push({ id: `flow:${i}`, from: chain[i].key, to: chain[i + 1].key, fromDept: chain[i].department, toDept: chain[i + 1].department, via: ["flow"], step: i });
  scenes.push({
    id: "flow", kind: "flow", duration: 15000, camera: { type: "fit" },
    steps: steps.map((s) => ({ key: s.key, label: s.label, line: s.line, planned: s.planned, live: s.live.slice(0, 2).map((a) => investorize(a.name)), plannedNames: s.planned ? s.agents.slice(0, 2).map((a) => investorize(a.name)) : [], nodeIds: (s.live.length ? s.live : s.agents).slice(0, 3).map((a) => `a:${a.key}`) })),
    flowLinks,
    lit: null, links: null,
    eyebrow: "End to end",
    title: ["How it works together"],
    lead: "One client's journey from first click to monthly report, and the agent that carries each step.",
  });

  // 5. Pillar health
  const ps = Object.values(scores || {}).filter((p) => p && Number.isFinite(p.score));
  const weakest = weakestPillars(scores, 1)[0];
  scenes.push({
    id: "pillars", kind: "pillars", duration: 10000, camera: { type: "fit" },
    lit: new Set(["brain"]), links: new Set(),
    eyebrow: scoredOn ? `Scored ${scoredOn} from live records` : "Business health",
    title: ["Pillar health"],
    lead: ps.length ? "Eight pillars, each scored 0 to 100 from the company's own records every morning." : "Pillar scores appear here once the daily brief has scored the business.",
    pillars: ["sales", "marketing", "delivery", "finance", "clients", "team", "systems", "owner"].map((id) => ({ id, name: scores?.[id]?.name || PILLAR_NAMES[id], score: Number.isFinite(scores?.[id]?.score) ? scores[id].score : null })),
    weakest: weakest ? weakest.id : null,
  });

  // 6. What we strengthen next
  const { weak, actions } = nextActions({ scores, agents: hq, launchItems, n: 3, limit: 7 });
  const weakDepts = new Set(weak.flatMap((p) => deptsForPillar(p.id)));
  scenes.push({
    id: "next", kind: "next", duration: 14000, camera: { type: "fit" },
    lit: new Set([...actions.filter((x) => x.agentKey).map((x) => `a:${x.agentKey}`), ...[...weakDepts].map((k) => `d:${k}`), ...hq.filter((a) => weak.some((p) => pillarOfAgent(a) === p.id) && a.status === "live").map((a) => `a:${a.key}`)]),
    links: new Set(),
    eyebrow: "The plan",
    title: ["What we strengthen next"],
    lead: weak.length ? `Starting with the weakest pillars: ${list(weak.map((p) => `${p.name || PILLAR_NAMES[p.id]} (${p.score})`))}.` : "Next steps appear once the pillars are scored.",
    actions,
    foot: actions.length ? "Ranked by impact: how far the pillar is from 100, times how much each step unlocks." : "",
  });

  return scenes;
}

import { base44 } from "@/api/base44Client";

export const PROJECT_TYPES = ["website", "app", "branding", "marketing", "seo", "automation", "consulting", "internal", "other"];
export const TASK_CATEGORIES = ["design", "development", "strategy", "content", "marketing", "sales", "admin", "finance", "ops"];
const OWNERS = ["Justin", "Claude", "Client"];
const EFFORTS = ["S", "M", "L"];

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", description: "One line: go / test small / park, and why" },
    verdict_tag: { type: "string", enum: ["GO", "TEST SMALL", "PARK", "KILL"] },
    project_type: { type: "string", enum: PROJECT_TYPES },
    do_first: {
      type: "object",
      properties: {
        title: { type: "string", description: "The single action for the next 60 minutes" },
        steps: { type: "array", items: { type: "string" }, description: "3-5 concrete sub-steps that fit in 60 minutes" },
        done_when: { type: "string", description: "What exists at the end of the hour" },
      },
      required: ["title", "steps", "done_when"],
    },
    pareto: {
      type: "array",
      description: "The 20% of work that produces 80% of the result, ranked most important first (3-6 items)",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          why: { type: "string" },
          effort: { type: "string", enum: EFFORTS },
        },
        required: ["title", "why", "effort"],
      },
    },
    phases: {
      type: "array",
      description: "Exactly 3 phases",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          goal: { type: "string" },
          timeframe: { type: "string", description: "Rough estimate, e.g. 'Days 1-3'" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                owner: { type: "string", enum: OWNERS },
                category: { type: "string", enum: TASK_CATEGORIES },
                effort: { type: "string", enum: EFFORTS },
              },
              required: ["title", "owner", "category", "effort"],
            },
          },
        },
        required: ["name", "goal", "steps"],
      },
    },
    ignore: { type: "array", items: { type: "string" }, description: "Things to deliberately not do yet" },
    risks: { type: "array", items: { type: "string" } },
    kill_criteria: { type: "array", items: { type: "string" }, description: "Concrete signals that mean stop" },
    first_metric: {
      type: "object",
      properties: { name: { type: "string" }, target: { type: "string" }, why: { type: "string" } },
      required: ["name", "target"],
    },
    hormozi_angle: {
      type: "object",
      properties: {
        relevant: { type: "boolean" },
        offer: { type: "string", description: "Grand-slam offer framing, if this can be sold" },
        dream_outcome: { type: "string" },
        likelihood: { type: "string", description: "How to raise perceived likelihood of achievement" },
        time_delay: { type: "string", description: "How to cut time to result" },
        effort_sacrifice: { type: "string", description: "How to cut effort for the buyer" },
      },
    },
    resources: { type: "array", items: { type: "string" }, description: "Tools, accounts, assets needed" },
  },
  required: ["verdict", "verdict_tag", "do_first", "pareto", "phases", "ignore", "risks", "kill_criteria", "first_metric", "resources"],
};

async function safe(fn, fallback) {
  try { return await fn(); } catch { return fallback; }
}

export async function loadContext() {
  const [clients, projects] = await Promise.all([
    safe(() => base44.entities.CRMClient.list("-updated_date", 200), []),
    safe(() => base44.entities.Project.list("-updated_date", 100), []),
  ]);
  const active = clients.filter((c) => c.status === "Active");
  const liveProjects = projects.filter((p) => !["done", "launched", "on_hold"].includes(p.status));
  return { clients, active, liveProjects };
}

export async function generatePlan(idea) {
  const ctx = await loadContext();
  const clientLines = ctx.active.slice(0, 40).map((c) => `- ${c.business}${c.industry ? ` (${c.industry})` : ""}${c.plan ? ` — ${c.plan}` : ""}`).join("\n") || "(none)";
  const projectLines = ctx.liveProjects.slice(0, 30).map((p) => `- ${p.title} [${p.type || "other"} · ${p.status}]${p.client_name ? ` for ${p.client_name}` : ""}`).join("\n") || "(none)";

  const prompt = `You are Justin Cowell's operator and strategist. Justin runs Interstellar Strategies, a full-stack digital agency in Molalla, OR (web design/dev, SEO incl. AIO/GEO/AEO and local SEO, automation, custom Base44 software, care plans). Goal: $1M revenue in 2027 using Alex Hormozi's methods (grand-slam offers, value equation, lead magnets, focus on the constraint). He works with Claude as a build partner and has a small team.

CURRENT CONTEXT
Active clients (${ctx.active.length} of ${ctx.clients.length} in CRM):
${clientLines}

Live projects (${ctx.liveProjects.length}):
${projectLines}

THE IDEA
Title: ${idea.title}
Category: ${idea.category || "—"}
Status: ${idea.status || "New"}
Description: ${idea.description || "(no description — infer sensibly from the title)"}
${idea.aiAnalysis ? `Earlier notes on it:\n${String(idea.aiAnalysis).slice(0, 1500)}` : ""}

YOUR JOB
Do not just analyse. Give Justin a real execution plan he can start right now.
- verdict: one blunt line. verdict_tag: GO, TEST SMALL, PARK or KILL.
- do_first: the ONE thing to do in the next 60 minutes, with 3-5 concrete sub-steps and what exists when the hour is up. Specific (name the doc, page, list, message), never "research the market".
- pareto: the 20% of work that drives 80% of the result, ranked. Each with why it matters and an effort estimate S (<2h), M (half to 2 days), L (3+ days).
- phases: exactly 3 phases (e.g. Prove it / Build it / Scale it), each with a goal, rough timeframe and 3-6 concrete steps. Each step: owner Justin, Claude or Client (Claude for drafting, research, code, copy, setup; Justin for decisions, sales calls, approvals; Client only when a client must supply something), a task category and S/M/L effort.
- ignore: what to deliberately not do yet.
- risks and kill_criteria: concrete, measurable where possible.
- first_metric: the one number to watch first, with a target.
- hormozi_angle: if this can be sold or packaged, frame it with the value equation (dream outcome, perceived likelihood, time delay, effort and sacrifice) and an offer line. Set relevant=false if it is purely internal.
- resources: tools, accounts and assets needed. Prefer what he already uses (Base44, Framer, Claude, Google Business Profile, Stripe).
Reference his real clients and projects when it helps (e.g. a pilot client). Be concise and practical; no fluff.`;

  const plan = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: "claude_sonnet_4_6",
    response_json_schema: PLAN_SCHEMA,
  });
  const fields = { plan, plan_generated_at: new Date().toISOString(), plan_progress: {} };
  await base44.entities.Idea.update(idea.id, fields);
  return fields;
}

const EFFORT_MIN = { S: 90, M: 480, L: 1440 };

export async function createProjectFromPlan(idea) {
  const plan = idea.plan || {};
  const type = PROJECT_TYPES.includes(plan.project_type) ? plan.project_type : "internal";
  const desc = [
    plan.verdict,
    idea.description,
    plan.first_metric?.name ? `First metric: ${plan.first_metric.name} → ${plan.first_metric.target}` : "",
    "Created from the Idea Vault action plan.",
  ].filter(Boolean).join("\n\n");
  const project = await base44.entities.Project.create({
    title: idea.title, type, status: "planning", description: desc, billing: "unpaid", priority: 2,
  });

  const base = { status: "next", project_id: project.id, project_name: project.title, project_type: type, source: "ai", task_type: "internal" };
  const tasks = [];
  if (plan.do_first?.title) {
    tasks.push({ ...base, title: `Do first: ${plan.do_first.title}`, priority: 1, category: "strategy", is_focus: true, estimated_minutes: 60, notes: (plan.do_first.steps || []).map((s) => `- ${s}`).join("\n") + (plan.do_first.done_when ? `\n\nDone when: ${plan.do_first.done_when}` : "") });
  }
  (plan.phases || []).forEach((ph, pi) => {
    (ph.steps || []).forEach((st) => {
      tasks.push({
        ...base,
        title: st.title,
        priority: Math.min(4, pi + 2),
        category: TASK_CATEGORIES.includes(st.category) ? st.category : "ops",
        estimated_minutes: EFFORT_MIN[st.effort] || 0,
        labels: [`phase-${pi + 1}`, `owner-${(st.owner || "justin").toLowerCase()}`],
        notes: `Phase ${pi + 1}: ${ph.name}${ph.goal ? ` — ${ph.goal}` : ""}\nOwner: ${st.owner || "Justin"} · Effort (est.): ${st.effort || "?"}`,
      });
    });
  });
  if (tasks.length) {
    try { await base44.entities.Task.bulkCreate(tasks); }
    catch { for (const t of tasks) await base44.entities.Task.create(t); }
  }
  await base44.entities.Idea.update(idea.id, { project_id: project.id, status: "Planned" });
  return project;
}

// QA-only fake data for the `training` and `training-player` functions (preview sandbox with ?qa=1). Never used on
// the live app. Agency scope uses the real seed content (seedOps.js); client "c1" (Summit Roofing Co, fictional QA
// client) gets a crew track with Spanish and a few trainees for the manager view.
import { OPS_TRACK, OPS_MODULES } from "./seedOps";

const iso = (d) => d.toISOString();
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const ago = (h) => iso(new Date(Date.now() - h * 3600e3));
const ROLES = { office_hire: "New office hire", crew_member: "Crew member", crew_lead: "Crew lead", sales: "Sales", manager: "Manager", client_ops_build: "Client Operations & Build Specialist", custom: "Custom role" };

const crewSop = { type: "sop", id: "sop-crew", title: "Summit job-site SOP" };
const safetySop = { type: "sop", id: "sop-safety", title: "Summit roof safety rules" };
const CREW = [
  {
    title: "Roof safety, every job", summary: "The safety rules on every Summit roof.",
    lesson_md: "Safety comes before speed on every roof.\n\n- Tie off to an anchor before you step onto any roof steeper than 4/12.\n- Ladders extend 3 feet past the roof edge and get tied off at the top.\n- No one works on the roof alone. There's always a second person on site.\n- Stop work when wind gusts pass 25 mph or the deck is wet.",
    embeds: [],
    sop_refs: [safetySop],
    checklist: [{ id: "c1", text: "Put on your harness and have your lead check the fit." }, { id: "c2", text: "Set and tie off a ladder with your lead watching." }],
    quiz: [
      { id: "q1", question: "When do you tie off?", options: ["Only on steep roofs over 8/12", "Before stepping onto any roof steeper than 4/12", "When the lead tells you to"], answer_index: 1, explanation: "Tie off before you step onto any roof steeper than 4/12." },
      { id: "q2", question: "How far past the roof edge does the ladder go?", options: ["1 foot", "3 feet", "6 feet"], answer_index: 1, explanation: "Ladders extend 3 feet past the edge and are tied off at the top." },
    ],
    est_minutes: 15, required: true, gaps: [],
    es: { status: "approved", title: "Seguridad en el techo, en cada trabajo", summary: "Las reglas de seguridad en cada techo de Summit.", lesson_md: "La seguridad va antes que la velocidad en cada techo.\n\n- Asegúrate a un anclaje antes de pisar cualquier techo con pendiente mayor a 4/12.\n- Las escaleras sobresalen 3 pies del borde del techo y se amarran arriba.\n- Nadie trabaja solo en el techo. Siempre hay una segunda persona en el sitio.\n- Detén el trabajo cuando las ráfagas pasen de 25 mph o la cubierta esté mojada.", checklist: [{ id: "c1", text: "Ponte el arnés y pide a tu líder que revise el ajuste." }, { id: "c2", text: "Coloca y amarra una escalera con tu líder mirando." }], quiz: [{ id: "q1", question: "¿Cuándo te aseguras?", options: ["Solo en techos de más de 8/12", "Antes de pisar cualquier techo con más de 4/12", "Cuando el líder lo diga"], explanation: "Asegúrate antes de pisar cualquier techo con más de 4/12." }, { id: "q2", question: "¿Cuánto sobresale la escalera del borde?", options: ["1 pie", "3 pies", "6 pies"], explanation: "Las escaleras sobresalen 3 pies y se amarran arriba." }] },
  },
  {
    title: "A day on the job", summary: "From the shop at 6:30 to the last magnet sweep.",
    lesson_md: "Every job day runs the same way.\n\n- Be at the shop by 6:30 a.m. to load materials from the job sheet.\n- Tarp the landscaping and gutters before tear-off starts.\n- Take before photos of every slope in the job app.\n- Finish with a magnet sweep of the yard and driveway, twice.",
    embeds: [], sop_refs: [crewSop],
    checklist: [{ id: "c1", text: "Load a truck from a job sheet with your lead." }, { id: "c2", text: "Take before photos of every slope in the job app." }, { id: "c3", text: "Do a double magnet sweep on a finished job." }],
    quiz: [{ id: "q1", question: "When do you tarp landscaping?", options: ["After tear-off", "Before tear-off starts", "Only if it rains"], answer_index: 1, explanation: "Tarp landscaping and gutters before tear-off starts." }],
    est_minutes: 20, required: true, gaps: ["The SOP doesn't say who signs the job sheet at the end of the day."],
    es: { status: "draft", title: "Un día en el trabajo", summary: "Desde el taller a las 6:30 hasta el último barrido con imán.", lesson_md: "Cada día de trabajo sigue el mismo orden.\n\n- Llega al taller a las 6:30 a.m. para cargar materiales según la hoja de trabajo.\n- Cubre el jardín y las canaletas con lona antes de quitar el techo viejo.\n- Toma fotos de \"antes\" de cada pendiente en la app.\n- Termina con dos barridos con imán del patio y la entrada.", checklist: [{ id: "c1", text: "Carga una camioneta según la hoja de trabajo con tu líder." }, { id: "c2", text: "Toma fotos de \"antes\" de cada pendiente en la app." }, { id: "c3", text: "Haz el doble barrido con imán en un trabajo terminado." }], quiz: [{ id: "q1", question: "¿Cuándo cubres el jardín con lona?", options: ["Después de quitar el techo", "Antes de quitar el techo viejo", "Solo si llueve"], explanation: "Cubre jardín y canaletas antes de empezar." }] },
  },
  {
    title: "Quality standard and photos", summary: "What done right looks like.",
    lesson_md: "Safety comes first, then quality.\n\n> **Needs SOPs:** nothing in the selected SOPs covers this module yet.",
    embeds: [], sop_refs: [], checklist: [], quiz: [], est_minutes: 10, required: true, needs_sops: true,
    gaps: ["Needs an SOP for the quality checklist and photo rules."],
  },
];

const store = { tracks: [], modules: [], assignments: [] };
let seeded = false;
function seed() {
  if (seeded) return;
  seeded = true;
  const ops = { id: "trk_ops", client_id: "agency", ...OPS_TRACK, created_via: "seed", updated_date: ago(20), drafted_at: ago(20) };
  ops.module_ids = OPS_MODULES.map((m, i) => { const id = `mod_ops_${i}`; store.modules.push({ id, track_id: ops.id, client_id: "agency", sort: i, embeds: [], drafted: true, ...m }); return id; });
  const crew = { id: "trk_crew", client_id: "c1", title: "Crew member onboarding", role: "crew_member", role_label: "Crew member", description: "Your first week on a Summit crew: safety, the job-day routine and our quality standard.", status: "published", es_enabled: true, pass_score: 80, requires_signoff: true, created_via: "portal", updated_date: ago(3), source_refs: [crewSop, safetySop], gaps: ["The SOPs don't cover the quality checklist yet."] };
  crew.module_ids = CREW.map((m, i) => { const id = `mod_crew_${i}`; store.modules.push({ id, track_id: crew.id, client_id: "c1", sort: i, drafted: true, ...m }); return id; });
  const office = { id: "trk_office", client_id: "c1", title: "Office hire onboarding", role: "office_hire", role_label: "New office hire", description: "Front office: phones, scheduling, paperwork and customer care.", status: "needs_sops", template_key: "office_hire", created_via: "portal", updated_date: ago(50), module_ids: [], gaps: ["Outline only: every module needs your SOPs."] };
  ["Welcome, tools and logins", "How a job flows: first call to paid", "Phones, messages and booking", "Quotes, invoices and payments"].forEach((t, i) => { const id = `mod_off_${i}`; office.module_ids.push(id); store.modules.push({ id, track_id: office.id, client_id: "c1", sort: i, title: t, summary: "", lesson_md: "> **Needs SOPs:** add your SOP for this module.", checklist: [], quiz: [], est_minutes: 15, required: true, needs_sops: true, gaps: ["Needs an SOP."] }); });
  store.tracks.push(ops, crew, office);
  const P = (lesson, checks, score, passed, attempts) => ({ lesson_done: lesson, checks, quiz_score: score, last_score: score, quiz_passed: passed, attempts, completed_at: passed ? ago(30) : "" });
  store.assignments.push(
    { id: "asg_1", track_id: "trk_crew", client_id: "c1", trainee_name: "Marco Reyes", trainee_email: "marco@summit.test", language: "es", start_date: day(-6), due_date: day(4), status: "in_progress", started_at: ago(140), last_active_at: ago(5), access_token: "qa", progress: { mod_crew_0: P(true, { c1: true, c2: true }, 100, true, 1), mod_crew_1: P(true, { c1: true }, null, false, 0) }, current_module_id: "mod_crew_1", pct: 33, questions: [{ id: "q_1", module_id: "mod_crew_1", module_title: "A day on the job", text: "If the job sheet is missing a material, who do I call?", asked_at: ago(5), answer: "" }] },
    { id: "asg_2", track_id: "trk_crew", client_id: "c1", trainee_name: "Tyler Brooks", trainee_email: "", language: "en", start_date: day(-14), due_date: day(-2), status: "in_progress", started_at: ago(320), last_active_at: ago(170), access_token: "qa", progress: { mod_crew_0: P(true, { c1: true, c2: true }, 50, false, 3) }, current_module_id: "mod_crew_0", pct: 0, questions: [] },
    { id: "asg_3", track_id: "trk_crew", client_id: "c1", trainee_name: "Dana Ortiz", trainee_email: "dana.o@summit.test", language: "en", start_date: day(-10), due_date: day(1), status: "awaiting_signoff", started_at: ago(230), last_active_at: ago(26), access_token: "qa", progress: { mod_crew_0: P(true, { c1: true, c2: true }, 100, true, 1), mod_crew_1: P(true, { c1: true, c2: true, c3: true }, 100, true, 1), mod_crew_2: P(true, {}, null, false, 0) }, current_module_id: "mod_crew_2", pct: 100, questions: [] },
    { id: "asg_4", track_id: "trk_crew", client_id: "c1", trainee_name: "Sam Patel", trainee_email: "", language: "en", start_date: day(-30), due_date: day(-16), status: "completed", started_at: ago(700), last_active_at: ago(400), completed_at: ago(400), signoff: { by: "Dana Reyes", at: ago(398) }, badge: { code: "IS-SAM001", title: "Crew member onboarding · Completed" }, access_token: "qa", progress: {}, pct: 100, questions: [] },
  );
}

const mods = (t) => t.module_ids.map((id) => store.modules.find((m) => m.id === id)).filter(Boolean);
const done = (m, p) => !!p && p.lesson_done && (m.checklist || []).every((c) => p.checks?.[c.id]) && (!(m.quiz || []).length || p.quiz_passed);
const flags = (a) => {
  const open = !["completed", "archived"].includes(a.status);
  const idle = a.last_active_at ? (Date.now() - Date.parse(a.last_active_at)) / 864e5 : 0;
  return { overdue: open && !!a.due_date && a.due_date < day(0), stuck: open && a.status !== "awaiting_signoff" && (idle >= 5 || Object.values(a.progress || {}).some((p) => p.attempts >= 3 && !p.quiz_passed)), open_questions: (a.questions || []).filter((q) => !q.answer).length, idle_days: Math.floor(idle) };
};

function payload(t, a, reveal) {
  const ms = mods(t);
  return {
    business: t.client_id === "agency" ? "Interstellar Strategies" : "Summit Roofing Co",
    track: { id: t.id, title: t.title, description: t.description, role_label: t.role_label, pass_score: t.pass_score ?? 80, requires_signoff: t.requires_signoff !== false, es_available: !!t.es_enabled && ms.some((m) => m.es?.status === "approved") },
    modules: ms.map((m) => ({
      id: m.id, title: m.title, summary: m.summary, lesson_md: m.lesson_md, embeds: m.embeds || [], sop_refs: (m.sop_refs || []).map((r) => ({ title: r.title })),
      checklist: (m.checklist || []).map((c) => ({ id: c.id, text: c.text })), quiz: (m.quiz || []).map((q) => ({ id: q.id, question: q.question, options: q.options, ...(reveal ? { answer_index: q.answer_index, explanation: q.explanation } : {}) })),
      est_minutes: m.est_minutes, required: m.required !== false,
      es: t.es_enabled && m.es?.status === "approved" ? { ...m.es, quiz: m.es.quiz.map((q, i) => ({ ...q, ...(reveal ? { answer_index: m.quiz[i].answer_index } : {}) })) } : null,
    })),
    assignment: a ? { ...a } : null,
  };
}

const TEMPLATES = [
  ["office_hire", "New office hire", "Front office: phones, scheduling, paperwork and customer care."],
  ["crew_member", "Crew member", "Field crew: safety, equipment, the job-site routine and quality."],
  ["crew_lead", "Crew lead", "Leads a crew: morning plan, job-site leadership, quality and paperwork."],
  ["sales", "Sales", "Lead response, estimates, proposals, follow-up and handoff."],
  ["manager", "Manager", "Numbers, scheduling, people, quality and the weekly rhythm."],
  ["client_ops_build", "Client Operations & Build Specialist", "Interstellar's planned hire (Hiring plan): onboarding, connections, client content and package tasks inside Møthership™.", true],
];

export function qaTrainingInvoke(args = {}) {
  seed();
  const cid = args.client_id || "c1";
  const a = args.action;
  if (a === "overview") {
    const tracks = store.tracks.filter((t) => t.client_id === cid);
    return {
      scope: cid === "agency" ? "agency" : "client", client_id: cid, business: cid === "agency" ? "Interstellar Strategies" : "Summit Roofing Co", roles: ROLES, can_edit: true,
      tracks: tracks.map((t) => { const ms = mods(t); const as = store.assignments.filter((x) => x.track_id === t.id); return { ...t, modules: ms.length, needs_sops: ms.filter((m) => m.needs_sops).length, minutes: ms.reduce((s, m) => s + (m.est_minutes || 0), 0), gaps: (t.gaps || []).length + ms.reduce((s, m) => s + (m.gaps || []).length, 0), es_approved: ms.filter((m) => m.es?.status === "approved").length, active: as.filter((x) => x.status !== "completed").length, completed: as.filter((x) => x.status === "completed").length }; }),
      assignments: store.assignments.filter((x) => x.client_id === cid && x.status !== "archived").map((x) => {
        const t = store.tracks.find((tt) => tt.id === x.track_id);
        return { ...x, track_title: t?.title, modules: mods(t).map((m) => { const p = x.progress[m.id] || {}; return { id: m.id, title: m.title, required: true, quiz: (m.quiz || []).length, lesson_done: !!p.lesson_done, checks: Object.values(p.checks || {}).filter(Boolean).length, checklist: (m.checklist || []).length, quiz_score: p.quiz_score ?? null, last_score: p.last_score ?? null, attempts: p.attempts || 0, quiz_passed: !!p.quiz_passed, completed_at: done(m, p) ? p.completed_at || ago(10) : "" }; }), ...flags(x) };
      }),
    };
  }
  if (a === "track") { const t = store.tracks.find((x) => x.id === args.track_id); return { track: t, modules: mods(t), roles: ROLES }; }
  if (a === "templates") return { templates: TEMPLATES.filter((x) => cid === "agency" || !x[3]).map(([key, label, description]) => ({ key, label, description, modules: [] })) };
  if (a === "sources") {
    return cid === "agency"
      ? { sources: [["sop:6ae66fc398075033271c580e", "SOP-01 · Closing the Sale", "12 steps"], ["sop:6ae3be9c1cb216d1ab737ef5", "SOP-02 · Client Onboarding", "19 steps"], ["sop:6ae3be9c1cb216d1ab737ef7", "SOP-04 · Custom Website Build", "20 steps"], ["sop:6ae3beb856e863c5f4b26a13", "SOP-06 · HyperCare+ Setup (every tier)", "18 steps"]].map(([id, title, detail]) => ({ id, type: "sop", title, detail, group: "SOPs" })).concat([{ id: "hiring:ramp", type: "hiring", title: "Hiring plan · 30 / 60 / 90-day ramp", detail: "Days 1–30: learn the system…", group: "Hiring plan" }]), paste_allowed: true }
      : { sources: [{ id: "sop:sop-crew", type: "sop", title: "Summit job-site SOP", detail: "14 steps", group: "SOPs" }, { id: "sop:sop-safety", type: "sop", title: "Summit roof safety rules", detail: "9 steps", group: "SOPs" }, { id: "file:f1", type: "client_file", title: "Office procedures (PDF)", detail: "sop · description only", group: "Your documents" }], paste_allowed: true };
  }
  if (a === "player") {
    const asg = args.assignment_id ? store.assignments.find((x) => x.id === args.assignment_id) : null;
    const t = store.tracks.find((x) => x.id === (asg?.track_id || args.track_id));
    return { ...payload(t, asg, true), preview: true };
  }
  if (a === "draft") {
    const t = store.tracks.find((x) => x.id === (cid === "agency" ? "trk_ops" : "trk_crew"));
    return { track: t, dropped: 1, gaps: t.gaps, modules: t.module_ids.length };
  }
  if (a === "save_track") {
    const v = args.track || {};
    let t = store.tracks.find((x) => x.id === v.id);
    if (t) Object.assign(t, v); else { t = { id: `trk_${Date.now()}`, client_id: cid, module_ids: [], status: "draft", ...v }; store.tracks.unshift(t); }
    return { track: t };
  }
  if (a === "save_module") {
    const v = args.module || {};
    let m = store.modules.find((x) => x.id === v.id);
    if (m) Object.assign(m, v, { reviewed: true }); else { m = { id: `mod_${Date.now()}`, checklist: [], quiz: [], embeds: [], est_minutes: 15, required: true, ...v }; store.modules.push(m); store.tracks.find((t) => t.id === v.track_id)?.module_ids.push(m.id); }
    return { module: m };
  }
  if (a === "translate") { const m = store.modules.find((x) => x.id === args.module_id); m.es = { status: "draft", title: m.title, summary: m.summary, lesson_md: m.lesson_md, checklist: m.checklist, quiz: m.quiz }; return { module: m }; }
  if (a === "approve_es") { const m = store.modules.find((x) => x.id === args.module_id); m.es = { ...m.es, ...(args.es || {}), status: args.unapprove ? "draft" : "approved" }; return { module: m }; }
  if (a === "assign") { const id = `asg_${Date.now()}`; store.assignments.unshift({ id, track_id: args.track_id, client_id: cid, trainee_name: args.trainee_name, trainee_email: args.trainee_email, due_date: args.due_date, start_date: day(0), status: "not_started", progress: {}, pct: 0, questions: [], access_token: "qa", source: args.source || "manual" }); return { assignment: { id, access_token: "qa", path: `/t/${id}?k=qa` } }; }
  if (a === "signoff") { const x = store.assignments.find((y) => y.id === args.assignment_id); Object.assign(x, { status: "completed", signoff: { by: "You", at: iso(new Date()) }, badge: { code: "IS-QA0001" } }); return { assignment: x }; }
  if (a === "answer") { const x = store.assignments.find((y) => y.id === args.assignment_id); x.questions = x.questions.map((q) => (q.id === args.question_id ? { ...q, answer: args.answer, answered_at: iso(new Date()) } : q)); return { assignment: x }; }
  if (a === "update_assignment") { const x = store.assignments.find((y) => y.id === args.assignment_id); if (args.archive) x.status = "archived"; if (args.due_date !== undefined) x.due_date = args.due_date; return { assignment: x }; }
  if (a === "from_template") { const t = { id: `trk_${Date.now()}`, client_id: cid, title: args.title || "New track", status: "needs_sops", module_ids: [], role: args.template_key }; store.tracks.unshift(t); return { track: t }; }
  if (a === "reorder") { const t = store.tracks.find((x) => x.id === args.track_id); t.module_ids = args.module_ids; return { track: t }; }
  if (a === "delete_module") { store.tracks.forEach((t) => { t.module_ids = t.module_ids.filter((id) => id !== args.module_id); }); return { ok: true }; }
  if (a === "delete_track") { store.tracks = store.tracks.filter((t) => t.id !== args.track_id); return { ok: true }; }
  return {};
}

// Trainee link in QA: /t/asg_1?k=qa (Marco, crew track with Spanish).
export function qaPlayerInvoke(action, args = {}) {
  seed();
  const asg = store.assignments.find((x) => x.id === args.id) || store.assignments[0];
  const t = store.tracks.find((x) => x.id === asg.track_id);
  if (action === "save") {
    const m = mods(t).find((x) => x.id === args.module_id);
    const p = { ...(asg.progress[m.id] || {}) };
    if (args.lesson_done) p.lesson_done = true;
    if (args.check) p.checks = { ...(p.checks || {}), [args.check.id]: args.check.value !== false };
    if (args.language) asg.language = args.language;
    let result = null;
    if (Array.isArray(args.quiz_answers)) {
      const per = m.quiz.map((q, i) => ({ id: q.id, picked: args.quiz_answers[i], correct: args.quiz_answers[i] === q.answer_index, answer_index: q.answer_index, explanation: (args.language === "es" ? m.es?.quiz?.[i]?.explanation : null) || q.explanation }));
      const score = Math.round((per.filter((x) => x.correct).length / per.length) * 100);
      p.attempts = (p.attempts || 0) + 1; p.quiz_score = Math.max(p.quiz_score || 0, score); if (score >= 80) p.quiz_passed = true;
      result = { score, pass: score >= 80, per, pass_score: 80 };
    }
    asg.progress = { ...asg.progress, [m.id]: p };
    const ms = mods(t);
    asg.pct = Math.round((ms.filter((x) => done(x, asg.progress[x.id])).length / ms.length) * 100);
    asg.current_module_id = (ms.find((x) => !done(x, asg.progress[x.id])) || m).id;
    return { ...payload(t, asg, false), result };
  }
  if (action === "ask") { asg.questions = [...asg.questions, { id: `q_${Date.now()}`, module_id: args.module_id, text: args.text, asked_at: iso(new Date()), answer: "" }]; return payload(t, asg, false); }
  return payload(t, asg, false);
}

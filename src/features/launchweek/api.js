// Launch Week board: frontend API. Calls the launch-week backend function; in QA mode on the preview host (and when
// the function can't be reached) the same core runs in the browser on the same entities.
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import { zonedParts, TZ_DEFAULT } from "@/features/command/engine";
import * as L from "./core";
import { QA_LAUNCH_FILES } from "./qaFixtures";

export const errMsg = (e) => e?.response?.data?.error || e?.message || "Something went wrong";
const call = async (fn, args) => (await base44.functions.invoke(fn, args))?.data;
const rows = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
const today = () => zonedParts(new Date(), TZ_DEFAULT).date;
const softFail = (e) => !e?.response?.status || e.response.status >= 500;

let qaSeeded = null;
async function qaSeed() {
  if (!IS_QA) return;
  if (!qaSeeded) {
    qaSeeded = (async () => {
      const have = rows(await base44.entities.LaunchClientStatus.list("order", 5));
      if (have.length) return;
      for (const f of QA_LAUNCH_FILES) await L.lwImport(base44.entities, f.json, f.slug, { anySlug: true, screenshots: f.screenshots });
    })();
  }
  await qaSeeded;
}

async function localBoard() {
  const [clients, questions] = await Promise.all([
    base44.entities.LaunchClientStatus.list("order", 50),
    base44.entities.LaunchQuestion.list("order", 1000),
  ]);
  return { clients: rows(clients), questions: rows(questions) };
}

export async function loadBoard() {
  if (IS_QA) { await qaSeed(); return localBoard(); }
  try {
    const r = await call("launch-week", { action: "board" });
    if (r && Array.isArray(r.clients)) return r;
  } catch (e) { if (!softFail(e)) throw e; }
  return localBoard();
}

// mode: default | option | voice | typed | exact. statements: what to save (the option text, or the reviewed sentences).
export async function answerQuestion(id, { statements, raw_text, mode }) {
  const args = { id, statements, raw_text, mode };
  if (!IS_QA) {
    try { return await call("launch-week", { action: "answer", ...args }); } catch (e) { if (!softFail(e)) throw e; }
  }
  return L.lwAnswer(base44.entities, id, { statements, raw_text, mode, today: today() });
}

export async function setQuestionStatus(id, status) {
  if (!IS_QA) {
    try { return await call("launch-week", { action: "status", id, status }); } catch (e) { if (!softFail(e)) throw e; }
  }
  return L.lwSetStatus(base44.entities, id, status);
}

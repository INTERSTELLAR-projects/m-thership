// "New client prep": the walkthrough that worked with VSRL and Seacoast, from first research to launch.
// Each step links to where it gets done in Møthership ({id} = the client's id).
export const PREP_STEPS = [
  { key: "research", label: "Research the brand", hint: "Site, socials, stack, competitors; notes into their Brain.", to: "/clients/{id}?tab=dossier" },
  { key: "spec_site", label: "Build the spec website", hint: "A real-looking site on their brand, before the call.", to: "/clients/{id}?tab=systems" },
  { key: "spec_cmd", label: "Build the spec Command System", hint: "Their own system with their products and workflows.", to: "/clients/{id}?tab=systems" },
  { key: "demo_videos", label: "Demo videos (website, system, portal)", hint: "Three short walkthroughs to send ahead.", to: "/clients/{id}?tab=files" },
  { key: "invite_email", label: "Invite email (Mission Sequence)", hint: "The invite with the demo videos and a time to talk.", to: "/email" },
  { key: "call_structure", label: "Call structure + four-slide close", hint: "Agenda, questions to ask, and the four close slides.", to: "/presentations/projects" },
  { key: "closing_film", label: "Closing film", hint: "The short film that plays before the close.", to: "/presentations/projects" },
  { key: "call", label: "Call", hint: "Run the call; record it and log the answers.", to: "/calls" },
  { key: "audit_video", label: "Same-day audit video", hint: "Record the audit the same day while it's fresh.", to: "/clients/{id}?tab=audit" },
  { key: "quote", label: "Custom quote", hint: "Price the build and the monthly plan.", to: "/clients/{id}?tab=billing" },
  { key: "invoice", label: "Invoice", hint: "Send the invoice; note payment terms.", to: "/financial" },
  { key: "thanks_email", label: "Thank-you + next-call email", hint: "Thank them and book the process call.", to: "/email" },
  { key: "process_call", label: "Process call", hint: "Walk every process by pillar to find the cracks.", to: "/calls" },
  { key: "build", label: "Build", hint: "Website + Command System build, tracked as a project.", to: "/projects" },
  { key: "launch", label: "Launch", hint: "Go live, invite them to the portal, hand over.", to: "/flight-plan" },
];

export const linkFor = (step, clientId) => String(step.to || "").replace("{id}", clientId || "");

// A new checklist row for a client (or prospect). `done` = keys already finished.
export function newPrep(client, done = [], now = new Date().toISOString()) {
  const d = new Set(done);
  return {
    client_id: client && client.id, client_name: (client && (client.business || client.name)) || "New client",
    title: `New client prep · ${(client && (client.business || client.name)) || "New client"}`, status: "active", started_at: now,
    steps: PREP_STEPS.map((s) => ({ key: s.key, label: s.label, done: d.has(s.key), done_at: d.has(s.key) ? now : null })),
  };
}

// Steps in walkthrough order, merged with what is stored (new steps added later show as not done).
export function stepsOf(prep) {
  const stored = new Map(((prep && prep.steps) || []).map((s) => [s.key, s]));
  return PREP_STEPS.map((s) => ({ ...s, done: !!(stored.get(s.key) || {}).done, done_at: (stored.get(s.key) || {}).done_at || null, note: (stored.get(s.key) || {}).note || "" }));
}

export function progressOf(prep) {
  const steps = stepsOf(prep);
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done) || null };
}

// Tick or untick one step; returns the new steps array (and whether everything is now done).
export function toggleStep(prep, key, now = new Date().toISOString()) {
  const steps = stepsOf(prep).map((s) => (s.key === key ? { key: s.key, label: s.label, done: !s.done, done_at: !s.done ? now : null, note: s.note } : { key: s.key, label: s.label, done: s.done, done_at: s.done_at, note: s.note }));
  return { steps, complete: steps.every((s) => s.done) };
}

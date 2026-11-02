// Queue a deck for Claude: the brief + schema go into a ClaudeJob that targets one Presentation.
// Claude puts the deck in result_data.deck; the deck page (or approving in the Claude Queue) loads it.
import { base44 } from "@/api/base44Client";
import { STANDING_RULES } from "@/features/claude/jobs";
import { claudeDeckInstructions } from "@/features/presentations/lib/deckSchema";

export async function queueDeckJob({ presentationId, brief, meta = {}, title }) {
  return base44.entities.ClaudeJob.create({
    title: "Deck — " + (title || "presentation") + (meta.client_name ? " · " + meta.client_name : ""),
    kind: "presentation",
    instructions: [claudeDeckInstructions(brief, presentationId), "", "## Rules", ...STANDING_RULES.map((r) => "- " + r)].join("\n"),
    client_id: meta.client_id || "",
    client_name: meta.client_name || "",
    status: "queued",
    priority: 3,
    requested_at: new Date().toISOString(),
    complete_task_on_approve: false,
    context: { target: "presentation", presentation_id: presentationId, audience: meta.audience || "", tone: meta.tone || "" }
  });
}

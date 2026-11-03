// TEMPORARY: one-off sender test for Justin. Deleted right after use.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { onboardingEmail, sendBrandedEmail } from "../../shared/onboardingEmail.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("t") !== "d47cdd6d9de0ff6b631bc31a81cc9f51") return new Response("Not found", { status: 404 });
  const base44 = createClientFromRequest(req);
  const { subject, html } = onboardingEmail({ business: "Interstellar Strategies", contact: "Justin Cowell", portalUrl: "https://interstellar-mothership.com", email: "justin@interstellar-strategies.com" });
  await sendBrandedEmail(base44, { to: "justin@interstellar-strategies.com", subject: `[TEST] ${subject}`, html });
  return Response.json({ sent: true });
});

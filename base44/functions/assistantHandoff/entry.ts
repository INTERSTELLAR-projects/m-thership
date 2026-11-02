// Interstellar Assistant tool: "talk to Justin". Posts the client's message into their 1:1 Comms thread
// (ConversationMessage with client_id, same shape as the portal's chat_send). Admin previews never post.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolvePortalClient, json } from "../../shared/portalAssistant.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const ctx = await resolvePortalClient(base44, body);
    if ("error" in ctx) return ctx.error;
    const message = String(body?.message || "").trim().slice(0, 4000);
    if (!message) return json({ ok: false, error: "Write the message for Justin first." }, 400);
    const topic = String(body?.topic || "").trim().slice(0, 120);
    const content = `${body?.urgent === true ? "[URGENT] " : ""}${topic ? `${topic}: ` : ""}${message}\n\n(Sent via the Interstellar Assistant)`;

    if (ctx.preview) {
      return json({ ok: true, preview: true, sent: false, would_send: content, note: "Admin preview: nothing was posted. For a real client this lands in their Messages thread with Justin." });
    }
    const now = new Date().toISOString();
    const m = await ctx.db.ConversationMessage.create({
      client_id: ctx.cid, content, sender_role: "client", sender_client_id: ctx.cid, senderEmail: ctx.user.email,
      recipientEmail: "interstellar", messageType: "text", timestamp: now, sender_name: ctx.client.business,
    });
    return json({ ok: true, sent: true, message_id: m?.id || null, where: "Messages tab, thread with Interstellar Strategies", reply_time: "Justin usually replies within 1 business day." });
  } catch (_e) {
    return json({ error: "Couldn't send that right now. Suggest the Messages tab." }, 500);
  }
});

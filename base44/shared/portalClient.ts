import { secrets } from "base44:runtime";
import { termsGate } from "./termsServer.ts";

// Which CRMClient may this caller act for? Same rule as the portal function:
//   admin + client_id   -> that client (Justin previewing / acting for a client)
//   admin, no client_id -> null (agency-level admin usage)
//   portal user         -> the portal-enabled client whose portal_emails include their login. A login on several
//                          clients (package-deal owner) may pick one with client_id, but only among the clients
//                          whose portal_emails include that login; any other id falls back to their first client,
//                          so a portal user can never act on another client.
// Terms gate (docs/portal-terms.md): a portal login that has not accepted the active Terms of Service for this client
// resolves to no client, so every studio, fuel and AI function refuses it too. portal-terms passes skipTerms.
export async function resolveClient(db: any, user: any, asClient?: unknown, opts: { skipTerms?: boolean } = {}): Promise<Record<string, any> | null> {
  if (!user) return null;
  if (user.role === "admin") {
    if (!asClient) return null;
    return (await db.CRMClient.get(String(asClient)).catch(() => null)) || null;
  }
  const email = String(user.email || "").toLowerCase();
  const all = (await db.CRMClient.filter({ portal_enabled: true }, "business", 500).catch(() => [])) || [];
  // Lead-tier logins (Lead Engine) get none of the client tools behind this resolver (studios, fuel, AI, email…).
  const mine = all.filter((c: Record<string, any>) => c.portal_tier !== "lead" && ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email));
  const client = (asClient ? mine.find((c: Record<string, any>) => c.id === String(asClient)) : null) || mine[0] || null;
  if (client && !opts.skipTerms && (await termsGate(db, user, client))) return null;
  return client;
}

// Secret presence only: values are never returned, logged or compared.
// Deno.env first (Base44 app secrets), then the runtime secret store (same source the Stripe functions use).
export function getSecret(name: string) {
  let v = "";
  try { v = Deno.env.get(name) || ""; } catch { v = ""; }
  if (!v) { try { v = secrets.get(name) || ""; } catch { v = ""; } }
  return v;
}
export const hasSecret = (name: string) => getSecret(name).length > 0;

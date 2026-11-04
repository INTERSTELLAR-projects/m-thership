// Which CRMClient may this caller act for? Same rule as the portal function:
//   admin + client_id   -> that client (Justin previewing / acting for a client)
//   admin, no client_id -> null (agency-level admin usage)
//   portal user         -> the portal-enabled client whose portal_emails include their login; client_id is ignored,
//                          so a portal user can never act on another client.
export async function resolveClient(db: any, user: any, asClient?: unknown): Promise<Record<string, any> | null> {
  if (!user) return null;
  if (user.role === "admin") {
    if (!asClient) return null;
    return (await db.CRMClient.get(String(asClient)).catch(() => null)) || null;
  }
  const email = String(user.email || "").toLowerCase();
  const all = (await db.CRMClient.filter({ portal_enabled: true }, "business", 500).catch(() => [])) || [];
  return all.find((c: Record<string, any>) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email)) || null;
}

// Secret presence only: values are never returned, logged or compared.
export function hasSecret(name: string, secrets?: { get: (n: string) => string | undefined }) {
  let v = "";
  try { v = (secrets && secrets.get(name)) || ""; } catch { v = ""; }
  if (!v) { try { v = Deno.env.get(name) || ""; } catch { v = ""; } }
  return v.length > 0;
}
export function getSecret(name: string) {
  try { return Deno.env.get(name) || ""; } catch { return ""; }
}

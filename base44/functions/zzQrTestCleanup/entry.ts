import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
// Temporary (to be deleted): removes only the two QR redirect self-test records (zzTest01/zzTest02) and their scans.
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  let n = 0;
  for (const code of ["zzTest01", "zzTest02"]) {
    for (const s of (await db.QrScan.filter({ short_code: code }, "-at", 500)) || []) { await db.QrScan.delete(s.id); n++; }
    for (const q of (await db.QrCode.filter({ short_code: code }, "-created_date", 5)) || []) { await db.QrCode.delete(q.id); n++; }
  }
  return Response.json({ deleted: n });
});

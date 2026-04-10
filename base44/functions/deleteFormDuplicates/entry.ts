import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete the duplicate forms that were just created
    const forgeId = "69d97b6b6964fe31ae3f8374";
    const webOpsId = "69d97b6b16b5b599b6a1f7e7";

    await base44.entities.FormTemplate.delete(forgeId);
    await base44.entities.FormTemplate.delete(webOpsId);

    return Response.json({ success: true, message: "Duplicate forms deleted" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
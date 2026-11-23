// Client portal API. The handler lives in base44/shared/portalApi.ts (portal v2, Nov 2026, keeps this entry small).
import { portalHandler } from "../../shared/portalApi.ts";

Deno.serve(portalHandler);
// Terms gate (Nov 23 2026): portal logins resolve only after accepting the active Terms of Service (docs/portal-terms.md).

// Client portal API. The handler lives in base44/shared/portalApi.ts (portal v2, Nov 2026, keeps this entry small).
import { portalHandler } from "../../shared/portalApi.ts";

Deno.serve(portalHandler);

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// In-memory store for rate limiting (resets on deployment)
const loginAttempts = new Map();
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= RATE_LIMIT) {
    return true;
  }
  
  loginAttempts.set(ip, [...recentAttempts, now]);
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const ip = getClientIp(req);
  
  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many login attempts. Try again in 15 minutes.' },
      { status: 429 }
    );
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only what the caller needs, never the full user record (security hardening Nov 2026).
    return Response.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
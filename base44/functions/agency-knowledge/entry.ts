import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Agency knowledge for Claude tasks. Admin only.
//   GET                       -> text/markdown: every AgencyKnowledge section compiled into one doc
//   POST { format: "json" }   -> { markdown, sections: [{ key, title, body, data, updated_at }], offers, compiled_at }
//   POST { format: "markdown"} -> same as GET
// Each read stamps AppSettings key "agency_knowledge" pageSettings.last_read_by_claude_at so
// Settings > Agency knowledge can show when Claude last pulled the in-app version.
// Mirrors compileMarkdown() in src/features/agency/knowledge.js — keep the two in step.

type Row = Record<string, any>;

const sortSections = (rows: Row[]) => [...rows].sort((a, b) => (Number(a.sort) || 100) - (Number(b.sort) || 100) || String(a.title || '').localeCompare(String(b.title || '')));

function compile(rows: Row[]): string {
  const sorted = sortSections(rows);
  const latest = sorted.reduce((m, s) => (String(s.updated_at || s.updated_date || '') > m ? String(s.updated_at || s.updated_date || '') : m), '');
  const head = [
    '# Interstellar Strategies — Agency knowledge',
    '',
    `_Compiled from Møthership (Settings > Agency knowledge). ${sorted.length} sections${latest ? `, last edited ${latest.slice(0, 10)}` : ''}. The in-app version is the source of truth._`,
  ];
  const body = sorted.map((s) => [`## ${s.title || s.key}`, '', String(s.body || '').trim()].join('\n')).join('\n\n');
  return [...head, '', body].join('\n').trim();
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e: any) => (e?.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let format = 'markdown';
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body && body.format === 'json') format = 'json';
    } else {
      const f = new URL(req.url).searchParams.get('format');
      if (f === 'json') format = 'json';
    }

    const db = base44.asServiceRole.entities;
    const rows = ((await db.AgencyKnowledge.list('sort', 200)) || []) as Row[];
    const markdown = compile(rows);
    const now = new Date().toISOString();

    // Stamp the read (best effort; never blocks the response).
    try {
      const meta = ((await db.AppSettings.filter({ key: 'agency_knowledge' }, '-updated_date', 1)) || []) as Row[];
      const pageSettings = { ...((meta[0] && meta[0].pageSettings) || {}), last_read_by_claude_at: now, last_read_by: String(user.email || '') };
      if (meta[0]) await db.AppSettings.update(meta[0].id, { pageSettings });
      else await db.AppSettings.create({ key: 'agency_knowledge', pageSettings });
    } catch { /* stamp is a convenience */ }

    if (format === 'json') {
      const sections = sortSections(rows).map((s) => ({ key: s.key, title: s.title, body: s.body || '', data: s.data || null, updated_at: s.updated_at || s.updated_date || null }));
      const offers = (sections.find((s) => s.key === 'offers')?.data?.offers || []) as Row[];
      return Response.json({ markdown, sections, offers, compiled_at: now });
    }
    return new Response(markdown, { status: 200, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
}

import { SECTORS, PARTIES, AUDIENCES, METRICS, json } from '../_lib/intel.js';
import { computeObjective } from '../_lib/measure.js';

const MAX_OBJECTIVES = 50;

// GET /api/objectives -> objectives with their current measured value and status
export async function onRequestGet({ env }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    const { results } = await env.DB.prepare('SELECT * FROM objectives ORDER BY created_at DESC').all();
    const withValues = await Promise.all(results.map(async (o) => ({ ...o, ...(await computeObjective(env.DB, o)) })));
    return json({ objectives: withValues }, 200, { 'Cache-Control': 'no-store' });
}

// POST /api/objectives  { name, metric, comparator, target, party?, sector?, audience?, days }
export async function onRequestPost({ request, env }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Body must be JSON.' }, 400); }

    const name = String(b.name || '').trim().slice(0, 120);
    const target = Number(b.target);
    const days = Math.round(Number(b.days));
    const party = b.party || null, sector = b.sector || null, audience = b.audience || null;
    if (!name) return json({ error: 'Give the objective a name.' }, 400);
    if (!Object.keys(METRICS).includes(b.metric)) return json({ error: 'Unknown metric.' }, 400);
    if (!['atleast', 'atmost'].includes(b.comparator)) return json({ error: 'Comparator must be atleast or atmost.' }, 400);
    if (!Number.isFinite(target)) return json({ error: 'Target must be a number.' }, 400);
    if (!(days >= 1 && days <= 90)) return json({ error: 'Window must be 1-90 days.' }, 400);
    if (party && !PARTIES.includes(party)) return json({ error: 'Unknown party.' }, 400);
    if (sector && !SECTORS.includes(sector)) return json({ error: 'Unknown sector.' }, 400);
    if (audience && !AUDIENCES.includes(audience)) return json({ error: 'Unknown audience.' }, 400);

    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM objectives').first();
    if (count.n >= MAX_OBJECTIVES) return json({ error: `Limit of ${MAX_OBJECTIVES} objectives reached.` }, 400);

    const id = crypto.randomUUID();
    await env.DB.prepare(
        'INSERT INTO objectives (id, name, metric, comparator, target, party, sector, audience, days, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ).bind(id, name, b.metric, b.comparator, target, party, sector, audience, days, Math.floor(Date.now() / 1000)).run();
    return json({ ok: true, id });
}

// DELETE /api/objectives?id=...
export async function onRequestDelete({ request, env }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ error: 'Missing id.' }, 400);
    await env.DB.prepare('DELETE FROM objectives WHERE id = ?').bind(id).run();
    return json({ ok: true });
}

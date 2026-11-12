import { SECTORS, PARTIES, SENTIMENTS, AUDIENCES, json } from '../_lib/intel.js';

// GET /api/feed?sector=&party=&sentiment=&limit=50
export async function onRequestGet({ request, env }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    const u = new URL(request.url);
    const where = [];
    const args = [];
    const sector = u.searchParams.get('sector');
    const party = u.searchParams.get('party');
    const sentiment = u.searchParams.get('sentiment');
    if (sector && SECTORS.includes(sector)) { where.push('sector = ?'); args.push(sector); }
    if (party && PARTIES.includes(party)) { where.push('party = ?'); args.push(party); }
    if (sentiment && SENTIMENTS.includes(sentiment)) { where.push('sentiment = ?'); args.push(sentiment); }
    const audience = u.searchParams.get('audience');
    if (audience && AUDIENCES.includes(audience)) { where.push('audience = ?'); args.push(audience); }
    const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const { results } = await env.DB.prepare(
        `SELECT id, title, url, source, published_at AS publishedAt, sector, party, sentiment, audience, classified
         FROM items ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY published_at DESC LIMIT ?`,
    ).bind(...args, limit).all();
    const last = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull'").first();
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM items').first();
    return json({ items: results, lastPull: last ? Number(last.value) : null, total: total.n }, 200, { 'Cache-Control': 'no-store' });
}

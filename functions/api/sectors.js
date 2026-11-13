import { json } from '../_lib/intel.js';

// GET /api/sectors -> per-sector coverage and sentiment for the last 7 days, with the previous 7 days when that history exists.
export async function onRequestGet({ env }) {
    const now = Math.floor(Date.now() / 1000);
    const d7 = now - 7 * 86400, d14 = now - 14 * 86400;
    const cur = await env.DB.prepare(
        `SELECT sector, SUM(CASE WHEN sentiment='Positive' THEN 1 ELSE 0 END) AS pos, SUM(CASE WHEN sentiment='Neutral' THEN 1 ELSE 0 END) AS neu,
                SUM(CASE WHEN sentiment='Negative' THEN 1 ELSE 0 END) AS neg, COUNT(*) AS n
         FROM items WHERE published_at >= ? AND classified = 1 AND sector IS NOT NULL GROUP BY sector ORDER BY n DESC`).bind(d7).all().then((r) => r.results);
    const prev = await env.DB.prepare(
        'SELECT sector, COUNT(*) AS n FROM items WHERE published_at >= ? AND published_at < ? AND classified = 1 AND sector IS NOT NULL GROUP BY sector').bind(d14, d7).all().then((r) => r.results);
    const since = await env.DB.prepare('SELECT MIN(fetched_at) AS t FROM items').first();
    const hasPrior = !!(since && since.t) && since.t <= d14;
    const prevMap = Object.fromEntries(prev.map((p) => [p.sector, p.n]));
    return json({
        hasPrior,
        sectors: cur.map((r) => ({ ...r, prevN: hasPrior ? prevMap[r.sector] || 0 : null })),
    }, 200, { 'Cache-Control': 'no-store' });
}

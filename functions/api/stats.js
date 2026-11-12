import { json } from '../_lib/intel.js';

// GET /api/stats?days=7 -> aggregates for the dashboards
export async function onRequestGet({ request, env }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('days') || '7', 10) || 7, 1), 90);
    const since = Math.floor(Date.now() / 1000) - days * 86400;

    const q = (sql) => env.DB.prepare(sql).bind(since).all().then((r) => r.results);
    const [byParty, bySector, partyDaily, topSources] = await Promise.all([
        q(`SELECT party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party, sentiment`),
        q(`SELECT sector, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sector, sentiment`),
        q(`SELECT date(published_at, 'unixepoch') AS day, party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY day, party, sentiment ORDER BY day`),
        q(`SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC LIMIT 10`),
    ]);
    return json({ days, byParty, bySector, partyDaily, topSources }, 200, { 'Cache-Control': 'no-store' });
}

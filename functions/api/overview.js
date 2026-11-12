import { json } from '../_lib/intel.js';
import { computeObjective } from '../_lib/measure.js';

// GET /api/overview -> everything the Dashboard screen needs, from real stored coverage.
export async function onRequestGet({ env, data }) {
    const now = Math.floor(Date.now() / 1000);
    const d1 = now - 86400, d2 = now - 2 * 86400, d7 = now - 7 * 86400, d14 = now - 14 * 86400;
    const one = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
    const all = (sql, ...a) => env.DB.prepare(sql).bind(...a).all().then((r) => r.results);

    const since = await one('SELECT MIN(fetched_at) AS t FROM items');
    const [last24, prev24, mix, parties, trend, sectors, latest, sources, lastPull, quality, objectivesRaw] = await Promise.all([
        one('SELECT COUNT(*) AS n FROM items WHERE published_at >= ?', d1),
        one('SELECT COUNT(*) AS n FROM items WHERE published_at >= ? AND published_at < ?', d2, d1),
        all("SELECT sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sentiment", d7),
        all("SELECT party, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party, sentiment", d7),
        all("SELECT date(published_at, 'unixepoch') AS day, COUNT(*) AS n, SUM(CASE WHEN sentiment='Positive' THEN 1 ELSE 0 END) AS pos, SUM(CASE WHEN sentiment='Negative' THEN 1 ELSE 0 END) AS neg FROM items WHERE published_at >= ? AND classified = 1 GROUP BY day ORDER BY day", d14),
        all("SELECT sector, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND sector IS NOT NULL GROUP BY sector, sentiment", d7),
        all('SELECT title, url, source, published_at AS publishedAt, sector, party, sentiment FROM items ORDER BY published_at DESC LIMIT 8'),
        all('SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC LIMIT 6', d7),
        one("SELECT value FROM meta WHERE key = 'last_pull'"),
        one('SELECT COUNT(*) AS total, SUM(classified) AS tagged FROM items WHERE published_at >= ?', d7),
        env.DB.prepare('SELECT * FROM objectives WHERE org_id = ?').bind(data.auth.org.id).all().then((r) => r.results),
    ]);
    const objectives = await Promise.all(objectivesRaw.map(async (o) => ({ ...o, ...(await computeObjective(env.DB, o)) })));

    return json({
        generatedAt: now,
        collectingSince: since && since.t ? since.t : null,
        articles24h: last24.n,
        articlesPrev24h: prev24.n,
        sentimentMix: Object.fromEntries(['Positive', 'Neutral', 'Negative'].map((s) => [s, (mix.find((r) => r.sentiment === s) || {}).n || 0])),
        parties, trend, sectors, latest, sources,
        lastPull: lastPull ? Number(lastPull.value) : null,
        quality: { total: quality.total, tagged: quality.tagged || 0 },
        objectives: { total: objectives.length, met: objectives.filter((o) => o.status === 'Met').length, behind: objectives.filter((o) => o.status === 'Behind').length },
    }, 200, { 'Cache-Control': 'no-store' });
}

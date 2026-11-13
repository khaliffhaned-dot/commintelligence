import { AUDIENCES, json } from '../_lib/intel.js';
import { computeObjective } from '../_lib/measure.js';

// GET /api/report?days=30
// Barcelona Principle 6: report outputs, outcomes and impact. No advertising value equivalents (AVEs) anywhere.
export async function onRequestGet({ request, env, data }) {
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);
    const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('days') || '30', 10) || 30, 1), 90);
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const q = (sql, ...a) => env.DB.prepare(sql).bind(since, ...a).all().then((r) => r.results);

    const [totals, bySource, bySentiment, byAudience, byParty, quality, objectivesRaw] = await Promise.all([
        q('SELECT COUNT(*) AS articles, COUNT(DISTINCT source) AS sources FROM items WHERE published_at >= ?'),
        q('SELECT source, COUNT(*) AS n FROM items WHERE published_at >= ? GROUP BY source ORDER BY n DESC'),
        q("SELECT sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 GROUP BY sentiment"),
        q("SELECT audience, sentiment, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND audience IS NOT NULL GROUP BY audience, sentiment"),
        q("SELECT party, COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 AND party IN ('BN','PH','PN','GPS','GRS') GROUP BY party"),
        q('SELECT SUM(classified) AS tagged, COUNT(*) AS total, SUM(CASE WHEN audience IS NOT NULL THEN 1 ELSE 0 END) AS withAudience FROM items WHERE published_at >= ?'),
        env.DB.prepare('SELECT * FROM objectives WHERE org_id = ? ORDER BY created_at DESC').bind(data.auth.org.id).all().then((r) => r.results),
    ]);
    const objectives = await Promise.all(objectivesRaw.map(async (o) => ({ ...o, ...(await computeObjective(env.DB, o)) })));

    const social = await env.DB.prepare('SELECT channel, COUNT(*) AS n FROM social_posts WHERE published_at >= ? GROUP BY channel').bind(since).all().then((x) => x.results);
    const channels = ['Online news', ...social.filter((s) => s.n > 0).map((s) => (s.channel === 'youtube' ? 'YouTube comments' : 'Reddit'))];

    const mix = Object.fromEntries(['Positive', 'Neutral', 'Negative'].map((s) => [s, (bySentiment.find((r) => r.sentiment === s) || {}).n || 0]));
    const tagged = mix.Positive + mix.Neutral + mix.Negative;
    const audienceRows = AUDIENCES.map((a) => {
        const rows = byAudience.filter((r) => r.audience === a);
        const n = rows.reduce((s, r) => s + r.n, 0);
        const pos = rows.filter((r) => r.sentiment === 'Positive').reduce((s, r) => s + r.n, 0);
        const neg = rows.filter((r) => r.sentiment === 'Negative').reduce((s, r) => s + r.n, 0);
        return { audience: a, articles: n, netSentiment: n ? Math.round(((pos - neg) / n) * 100) : null };
    }).filter((r) => r.articles);

    return json({
        days,
        outputs: { articles: totals[0].articles, sources: totals[0].sources, bySource: bySource.slice(0, 8), channels },
        outcomes: {
            sentimentMix: mix,
            netSentiment: tagged ? Math.round(((mix.Positive - mix.Negative) / tagged) * 100) : null,
            byAudience: audienceRows,
            shareOfVoiceByParty: byParty,
        },
        impact: {
            objectives,
            met: objectives.filter((o) => o.status === 'Met').length,
            total: objectives.length,
        },
        dataQuality: { total: quality[0].total, tagged: quality[0].tagged || 0, withAudience: quality[0].withAudience || 0 },
    }, 200, { 'Cache-Control': 'no-store' });
}

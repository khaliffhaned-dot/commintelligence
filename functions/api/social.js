import { SECTORS, PARTIES, SENTIMENTS, AUDIENCES, json } from '../_lib/intel.js';
import { youtubeConfigured, redditConfigured } from '../_lib/social.js';

// GET /api/social?channel=&sector=&party=&sentiment=&audience=&limit=50
export async function onRequestGet({ request, env }) {
    const u = new URL(request.url);
    const where = [];
    const args = [];
    const channel = u.searchParams.get('channel');
    if (channel && ['youtube', 'reddit'].includes(channel)) { where.push('channel = ?'); args.push(channel); }
    for (const [param, list, col] of [['sector', SECTORS, 'sector'], ['party', PARTIES, 'party'], ['sentiment', SENTIMENTS, 'sentiment'], ['audience', AUDIENCES, 'audience']]) {
        const v = u.searchParams.get(param);
        if (v && list.includes(v)) { where.push(`${col} = ?`); args.push(v); }
    }
    const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const { results } = await env.DB.prepare(
        `SELECT id, channel, text, url, label, published_at AS publishedAt, score, sector, party, sentiment, audience, classified
         FROM social_posts ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY published_at DESC LIMIT ?`,
    ).bind(...args, limit).all();
    const last = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull_social'").first();
    const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM social_posts').first();
    return json({
        items: results, total: total.n, lastPull: last ? Number(last.value) : null, retentionDays: 14,
        configured: { youtube: youtubeConfigured(env), reddit: redditConfigured(env) },
    }, 200, { 'Cache-Control': 'no-store' });
}

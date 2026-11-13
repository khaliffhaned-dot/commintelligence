import { json } from '../_lib/intel.js';

// GET /api/search?q=name -> real stored coverage that mentions the name (news headlines, plus social posts if collected).
// This only searches what the platform has stored. It invents nothing.
export async function onRequestGet({ request, env }) {
    const q = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 2) return json({ error: 'Enter at least 2 characters.' }, 400);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;

    const [news, social, span] = await Promise.all([
        env.DB.prepare(`SELECT title, url, source, published_at AS publishedAt, sentiment, sector, party FROM items
                        WHERE title LIKE ? ESCAPE '\\' ORDER BY published_at DESC LIMIT 60`).bind(like).all().then((r) => r.results),
        env.DB.prepare(`SELECT text, url, channel, label, published_at AS publishedAt, sentiment FROM social_posts
                        WHERE text LIKE ? ESCAPE '\\' ORDER BY published_at DESC LIMIT 20`).bind(like).all().then((r) => r.results),
        env.DB.prepare('SELECT COUNT(*) AS total, MIN(published_at) AS oldest FROM items').first(),
    ]);

    const tally = { Positive: 0, Neutral: 0, Negative: 0, Untagged: 0 };
    for (const n of news) tally[n.sentiment && tally[n.sentiment] !== undefined ? n.sentiment : 'Untagged']++;
    return json({ q, news, social, tally, corpus: { articles: span.total, oldest: span.oldest } }, 200, { 'Cache-Control': 'no-store' });
}

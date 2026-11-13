import { json } from '../_lib/intel.js';

// Malaysian states and federal territories. Matching is case-sensitive and whole-word so that, for example,
// the Malay word "perak" (silver) does not count as the state. Coordinates are approximate centres for map markers.
const REGIONS = [
    { name: 'Johor', re: /\bJohor\b/, lat: 1.93, lng: 103.36 },
    { name: 'Kedah', re: /\bKedah\b/, lat: 6.12, lng: 100.37 },
    { name: 'Kelantan', re: /\bKelantan\b/, lat: 5.55, lng: 102.0 },
    { name: 'Melaka', re: /\b(Melaka|Malacca)\b/, lat: 2.19, lng: 102.25 },
    { name: 'Negeri Sembilan', re: /\bNegeri Sembilan\b/, lat: 2.73, lng: 102.25 },
    { name: 'Pahang', re: /\bPahang\b/, lat: 3.8, lng: 102.9 },
    { name: 'Perak', re: /\bPerak\b/, lat: 4.6, lng: 101.1 },
    { name: 'Perlis', re: /\bPerlis\b/, lat: 6.44, lng: 100.2 },
    { name: 'Pulau Pinang', re: /\b(Penang|Pulau Pinang)\b/, lat: 5.4, lng: 100.33 },
    { name: 'Sabah', re: /\bSabah\b/, lat: 5.98, lng: 116.07 },
    { name: 'Sarawak', re: /\bSarawak\b/, lat: 2.5, lng: 113.5 },
    { name: 'Selangor', re: /\bSelangor\b/, lat: 3.3, lng: 101.5 },
    { name: 'Terengganu', re: /\bTerengganu\b/, lat: 5.0, lng: 103.0 },
    { name: 'Kuala Lumpur', re: /\b(Kuala Lumpur|KL)\b/, lat: 3.139, lng: 101.687 },
    { name: 'Putrajaya', re: /\bPutrajaya\b/, lat: 2.926, lng: 101.696 },
    { name: 'Labuan', re: /\bLabuan\b/, lat: 5.28, lng: 115.24 },
];

// GET /api/regions?days=7 -> real coverage counts per state, from headlines that name the state.
export async function onRequestGet({ request, env }) {
    const days = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('days') || '7', 10) || 7, 1), 90);
    const since = Math.floor(Date.now() / 1000) - days * 86400;
    const { results } = await env.DB.prepare(
        'SELECT title, url, source, published_at AS publishedAt, sentiment, classified FROM items WHERE published_at >= ? ORDER BY published_at DESC LIMIT 4000',
    ).bind(since).all();

    const regions = REGIONS.map((r) => ({ name: r.name, lat: r.lat, lng: r.lng, total: 0, tagged: 0, pos: 0, neg: 0, neu: 0, latest: [] }));
    let matched = 0;
    for (const item of results) {
        let hit = false;
        REGIONS.forEach((r, i) => {
            if (!r.re.test(item.title)) return;
            hit = true;
            const g = regions[i];
            g.total++;
            if (item.classified && item.sentiment) {
                g.tagged++;
                if (item.sentiment === 'Positive') g.pos++; else if (item.sentiment === 'Negative') g.neg++; else g.neu++;
            }
            if (g.latest.length < 4) g.latest.push({ title: item.title, url: item.url, source: item.source, publishedAt: item.publishedAt });
        });
        if (hit) matched++;
    }
    return json({ days, totalArticles: results.length, matched, regions }, 200, { 'Cache-Control': 'no-store' });
}

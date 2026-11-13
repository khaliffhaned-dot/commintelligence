// GNews (gnews.io) collector. Off until the GNEWS_API_KEY secret is set.
// Free plan (per docs.gnews.io): 100 requests/day, 10 articles/request, 1 request/second, 12-hour delay, non-commercial use only.
// Malay ('ms') is NOT a supported language, so Malay-language coverage still has to come from RSS.

// Four calls per cycle; the caller limits cycles to one per 90 minutes (<= ~64 requests/day).
const CALLS = [
    { country: 'my', lang: 'en', category: 'general' },
    { country: 'my', lang: 'en', category: 'business' },
    { country: 'my', lang: 'zh', category: 'general' },
    { country: 'my', lang: 'ta', category: 'general' },
];

// GNews's country filter is loose (it also returns stories merely 'about' a country), so keep only items that are
// clearly Malaysian: from a known Malaysian outlet, or with a headline that names Malaysia or a Malaysian institution.
const MY_OUTLETS = ['the star', 'the edge', 'new straits times', 'free malaysia today', 'malaysiakini', 'malay mail', 'bernama', 'sinar', 'the sun',
    'astro awani', 'the vibes', 'focus malaysia', 'lowyat', 'soyacincau', 'paul tan', 'berita harian', 'harian metro', 'utusan', 'kosmo', 'sin chew',
    'china press', 'oriental daily', 'nanban', 'tamil nesan', 'malaysian reserve', 'theedgemalaysia', 'thestar', 'dailyexpress', 'borneo post', 'new sarawak tribune'];
const MY_TERMS = /\b(malaysia|malaysian|malaysians|kuala lumpur|putrajaya|selangor|johor|penang|sarawak|sabah|kelantan|terengganu|perak|pahang|kedah|melaka|negeri sembilan|labuan|petaling jaya|anwar ibrahim|umno|pkr|bersatu|dewan rakyat|dewan negara|ringgit|bursa malaysia|petronas|tenaga nasional|maybank|cimb|khazanah|proton|perodua|mcmc|bank negara|madani)\b/i;

export function isMalaysiaRelevant(article) {
    const source = String((article.source && article.source.name) || '').toLowerCase();
    if (MY_OUTLETS.some((o) => source.includes(o))) return true;
    return MY_TERMS.test(`${article.title || ''} ${article.description || ''}`);
}

export const gnewsConfigured = (env) => !!env.GNEWS_API_KEY;

export async function fetchGNews(env) {
    const out = { articles: [], errors: [], filteredOut: 0 };
    for (let i = 0; i < CALLS.length; i++) {
        if (i) await new Promise((r) => setTimeout(r, 1100)); // stay under the 1 request/second limit
        const qs = new URLSearchParams({ ...CALLS[i], max: '10' });
        try {
            // The key travels in a header so it never appears in a URL or in logs.
            const res = await fetch(`https://gnews.io/api/v4/top-headlines?${qs}`, { headers: { 'X-Api-Key': env.GNEWS_API_KEY } });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                const first = Array.isArray(body.errors) ? body.errors[0] : Object.values(body.errors || {})[0];
                out.errors.push(`HTTP ${res.status}: ${String(first || 'request failed').slice(0, 120)}`);
                if ([400, 401, 403].includes(res.status)) break; // bad key or daily quota used: no point continuing
                continue;
            }
            for (const a of body.articles || []) {
                const published = Date.parse(a.publishedAt);
                if (!a.title || !a.url || Number.isNaN(published)) continue;
                if (!isMalaysiaRelevant(a)) { out.filteredOut++; continue; }
                out.articles.push({ title: a.title, url: a.url, source: (a.source && a.source.name) || 'GNews', publishedAt: Math.floor(published / 1000), feed: 'gnews' });
            }
        } catch (e) {
            out.errors.push(`request failed: ${e.message}`);
        }
    }
    out.errors = [...new Set(out.errors)].slice(0, 3);
    return out;
}

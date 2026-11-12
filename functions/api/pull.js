import { QUERIES, SECTORS, PARTIES, SENTIMENTS, rssUrl, parseRss, sha256, extractJson, json } from '../_lib/intel.js';

const COOLDOWN_SECONDS = 60;      // protects the AI/news quota from button-mashing
const MAX_CLASSIFY_PER_PULL = 60; // keeps one request inside the platform's subrequest limits
const BATCH = 12;
const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

async function classify(env, batch) {
    const list = batch.map((it, i) => `${i}. ${it.title}`).join('\n');
    const prompt = `Classify these Malaysian news headlines.
For each, return:
- "sector": one of ${JSON.stringify(SECTORS)}
- "party": the Malaysian political coalition the story is mainly about, one of ${JSON.stringify(PARTIES)} (BN, PH, PN, GPS, GRS, Other = another political party/figure, None = not political)
- "sentiment": tone toward the story's main subject, one of ${JSON.stringify(SENTIMENTS)}
Headlines:
${list}
Return only JSON: {"results":[{"i":0,"sector":"...","party":"...","sentiment":"..."}]}`;
    const out = await env.AI.run(env.AI_TEXT_MODEL || TEXT_MODEL, {
        messages: [
            { role: 'system', content: 'You are a precise media analyst for Malaysia. Reply with one valid JSON object only.' },
            { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
    });
    const raw = out && out.response !== undefined ? out.response : out;
    const parsed = raw && typeof raw === 'object' ? raw : extractJson(raw);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    const byIndex = new Map(results.map((r) => [Number(r.i), r]));
    return batch.map((_, i) => {
        const r = byIndex.get(i) || {};
        return {
            sector: SECTORS.includes(r.sector) ? r.sector : null,
            party: PARTIES.includes(r.party) ? r.party : null,
            sentiment: SENTIMENTS.includes(r.sentiment) ? r.sentiment : null,
        };
    });
}

export async function onRequestPost({ env }) {
    if (!env.DB || !env.AI) return json({ error: 'Missing D1 (DB) or Workers AI (AI) binding.' }, 500);

    const now = Math.floor(Date.now() / 1000);
    const last = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull'").first();
    const age = last ? now - Number(last.value) : Infinity;
    if (age < COOLDOWN_SECONDS) {
        return json({ skipped: true, nextPullInSeconds: Math.ceil(COOLDOWN_SECONDS - age) });
    }
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_pull', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(String(now)).run();

    // 1. Fetch every feed in parallel; one failing feed must not fail the pull.
    const fetched = await Promise.allSettled(QUERIES.map(async (q) => {
        const res = await fetch(rssUrl(q.q), { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MalaysiaIntel/1.0)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseRss(await res.text(), 10).map((it) => ({ ...it, query: q }));
    }));
    const feedErrors = fetched.filter((r) => r.status === 'rejected').length;
    const articles = fetched.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // 2. De-duplicate within this pull and against what is already stored.
    const unique = new Map();
    for (const a of articles) {
        const id = await sha256(a.url);
        if (!unique.has(id)) unique.set(id, { ...a, id });
    }
    const ids = [...unique.keys()];
    const known = new Set();
    for (let i = 0; i < ids.length; i += 90) {
        const chunk = ids.slice(i, i + 90);
        const { results } = await env.DB.prepare(`SELECT id FROM items WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
        results.forEach((r) => known.add(r.id));
    }
    const fresh = [...unique.values()].filter((a) => !known.has(a.id)).sort((a, b) => b.publishedAt - a.publishedAt);

    // 3. Tag the newest items with AI; the rest are stored with the search's own hints.
    const toClassify = fresh.slice(0, MAX_CLASSIFY_PER_PULL);
    let aiFailures = 0;
    for (let i = 0; i < toClassify.length; i += BATCH) {
        const batch = toClassify.slice(i, i + BATCH);
        try {
            const tags = await classify(env, batch);
            batch.forEach((it, j) => Object.assign(it, tags[j], { classified: 1 }));
        } catch (e) {
            aiFailures++;
            console.error('classify failed', e && e.message);
        }
    }

    // 4. Store everything (D1 batch = one round trip).
    if (fresh.length) {
        const stmt = env.DB.prepare(`INSERT OR IGNORE INTO items
            (id, title, url, source, published_at, fetched_at, query, sector, party, sentiment, classified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        for (let i = 0; i < fresh.length; i += 50) {
            await env.DB.batch(fresh.slice(i, i + 50).map((a) => stmt.bind(
                a.id, a.title, a.url, a.source, a.publishedAt, now, a.query.q,
                a.sector || a.query.sector, a.party || a.query.party || null, a.sentiment || null, a.classified || 0,
            )));
        }
    }

    return json({
        ok: true,
        fetchedFeeds: QUERIES.length - feedErrors,
        failedFeeds: feedErrors,
        newItems: fresh.length,
        classified: toClassify.filter((a) => a.classified).length,
        aiFailures,
    });
}

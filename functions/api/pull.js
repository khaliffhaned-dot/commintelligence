import { FEEDS, SECTORS, PARTIES, SENTIMENTS, parseRss, sha256, extractJson, json } from '../_lib/intel.js';

const COOLDOWN_SECONDS = 60;      // protects the AI/news quota from button-mashing
const MAX_CLASSIFY_PER_PULL = 72; // 6 AI calls per pull; backlog is worked off over successive pulls
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
    const fetched = await Promise.allSettled(FEEDS.map(async (f) => {
        const res = await fetch(f.url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MalaysiaIntel/1.0)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseRss(await res.text(), 50, f.name).map((it) => ({ ...it, feed: f.url }));
    }));
    const failed = fetched.filter((r) => r.status === 'rejected');
    const feedErrorSamples = [...new Set(failed.map((r) => String(r.reason && r.reason.message)))].slice(0, 3);
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
    const fresh = [...unique.values()].filter((a) => !known.has(a.id));

    // 3. Store every new article untagged first, so nothing is lost if tagging is slow or fails.
    if (fresh.length) {
        const stmt = env.DB.prepare(`INSERT OR IGNORE INTO items
            (id, title, url, source, published_at, fetched_at, query, classified) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`);
        for (let i = 0; i < fresh.length; i += 50) {
            await env.DB.batch(fresh.slice(i, i + 50).map((a) => stmt.bind(a.id, a.title, a.url, a.source, a.publishedAt, now, a.feed)));
        }
    }

    // 4. Tag the newest untagged articles (new ones plus any backlog) with AI.
    const { results: pending } = await env.DB.prepare(
        'SELECT id, title FROM items WHERE classified = 0 ORDER BY published_at DESC LIMIT ?').bind(MAX_CLASSIFY_PER_PULL).all();
    let tagged = 0, aiFailures = 0;
    const update = env.DB.prepare('UPDATE items SET sector = ?, party = ?, sentiment = ?, classified = 1 WHERE id = ?');
    for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        try {
            const tags = await classify(env, batch);
            await env.DB.batch(batch.map((it, j) => update.bind(tags[j].sector, tags[j].party, tags[j].sentiment, it.id)));
            tagged += batch.length;
        } catch (e) {
            aiFailures++;
            console.error('classify failed', e && e.message);
        }
    }
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE classified = 0').first();

    return json({
        ok: true,
        fetchedFeeds: FEEDS.length - failed.length,
        failedFeeds: failed.length,
        feedErrorSamples,
        newItems: fresh.length,
        tagged,
        untaggedRemaining: left.n,
        aiFailures,
    });
}

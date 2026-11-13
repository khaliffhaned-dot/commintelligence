import { FEEDS, parseRss, sha256, json } from '../_lib/intel.js';
import { classify } from '../_lib/classify.js';
import { embedPending } from '../_lib/semantic.js';
import { track } from '../_lib/metrics.js';
import { gnewsConfigured, fetchGNews } from '../_lib/gnews.js';

const COOLDOWN_SECONDS = 60;      // protects the AI/news quota from button-mashing
const MAX_CLASSIFY_PER_PULL = 72; // 6 AI calls per pull; backlog is worked off over successive pulls
const BATCH = 12;
const GNEWS_COOLDOWN_SECONDS = 5400; // 90 minutes: keeps the free plan (100 requests/day) safe
export async function onRequestPost({ env, data }) {
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

    // Optional: GNews, on its own slower schedule because of the plan's daily request cap.
    let gnews = { configured: false };
    if (gnewsConfigured(env)) {
        const lg = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_gnews'").first();
        if (lg && now - Number(lg.value) < GNEWS_COOLDOWN_SECONDS) {
            gnews = { configured: true, skipped: true, nextInSeconds: GNEWS_COOLDOWN_SECONDS - (now - Number(lg.value)) };
        } else {
            await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_gnews', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(now)).run();
            const g = await fetchGNews(env);
            articles.push(...g.articles);
            gnews = { configured: true, found: g.articles.length, filteredOut: g.filteredOut, errors: g.errors };
        }
    }

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
        'SELECT id, title FROM items WHERE classified = 0 OR audience IS NULL ORDER BY published_at DESC LIMIT ?').bind(MAX_CLASSIFY_PER_PULL).all();
    let tagged = 0, aiFailures = 0;
    const update = env.DB.prepare('UPDATE items SET sector = ?, party = ?, sentiment = ?, audience = ?, classified = 1 WHERE id = ?');
    for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        try {
            const tags = await classify(env, batch.map((b) => ({ text: b.title })));
            await env.DB.batch(batch.map((it, j) => update.bind(tags[j].sector, tags[j].party, tags[j].sentiment, tags[j].audience, it.id)));
            tagged += batch.length;
        } catch (e) {
            aiFailures++;
            console.error('classify failed', e && e.message);
        }
    }
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE classified = 0 OR audience IS NULL').first();

    // Add new articles to the semantic index (Vectorize). A failure here never fails the pull.
    let embedded = 0, embedError = null;
    try { embedded = await embedPending(env); } catch (e) { embedError = String((e && e.message) || e).slice(0, 120); console.error('embedding failed', embedError); }
    track(env, 'pull', [], [fresh.length, tagged, embedded, failed.length, aiFailures], data && data.auth ? data.auth.org.id : 'system');

    return json({
        ok: true,
        fetchedFeeds: FEEDS.length - failed.length,
        failedFeeds: failed.length,
        gnews,
        feedErrorSamples,
        newItems: fresh.length,
        tagged,
        untaggedRemaining: left.n,
        embedded,
        embedError,
        aiFailures,
    });
}

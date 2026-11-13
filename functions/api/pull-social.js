import { json } from '../_lib/intel.js';
import { classify } from '../_lib/classify.js';
import { fetchYouTube, fetchReddit } from '../_lib/social.js';

const COOLDOWN_SECONDS = 120;
const RETENTION_DAYS = 14;        // data minimisation: social posts are deleted after this long
const MAX_CLASSIFY_PER_PULL = 48;
const BATCH = 12;

// POST /api/pull-social: collect from YouTube + Reddit (whichever are configured), store, tag.
export async function onRequestPost({ env }) {
    if (!env.AI) return json({ error: 'Missing Workers AI binding.' }, 500);
    const now = Math.floor(Date.now() / 1000);

    const last = await env.DB.prepare("SELECT value FROM meta WHERE key = 'last_pull_social'").first();
    const age = last ? now - Number(last.value) : Infinity;
    if (age < COOLDOWN_SECONDS) return json({ skipped: true, nextPullInSeconds: Math.ceil(COOLDOWN_SECONDS - age) });
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('last_pull_social', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(String(now)).run();

    const [yt, rd] = await Promise.all([fetchYouTube(env), fetchReddit(env)]);
    const status = { youtube: { configured: yt.configured, found: yt.posts.length, errors: yt.errors }, reddit: { configured: rd.configured, found: rd.posts.length, errors: rd.errors } };
    if (!yt.configured && !rd.configured) return json({ ok: true, configured: false, status, newPosts: 0 });

    // Only keep posts inside the retention window, de-duplicated by id.
    const cutoff = now - RETENTION_DAYS * 86400;
    const unique = new Map();
    for (const p of [...yt.posts, ...rd.posts]) if (p.publishedAt >= cutoff && !unique.has(p.id)) unique.set(p.id, p);
    const posts = [...unique.values()];

    let newPosts = 0;
    if (posts.length) {
        const stmt = env.DB.prepare(`INSERT OR IGNORE INTO social_posts (id, channel, text, url, label, published_at, fetched_at, score, classified) VALUES (?,?,?,?,?,?,?,?,0)`);
        for (let i = 0; i < posts.length; i += 50) {
            const res = await env.DB.batch(posts.slice(i, i + 50).map((p) => stmt.bind(p.id, p.channel, p.text, p.url, p.label, p.publishedAt, now, p.score)));
            newPosts += res.reduce((n, r) => n + (r.meta && r.meta.changes ? r.meta.changes : 0), 0);
        }
    }
    // Refresh like/upvote counts on posts we already have.
    if (posts.length) {
        const upd = env.DB.prepare('UPDATE social_posts SET score = ? WHERE id = ?');
        for (let i = 0; i < posts.length; i += 50) await env.DB.batch(posts.slice(i, i + 50).map((p) => upd.bind(p.score, p.id)));
    }

    // Tag the newest untagged posts.
    const { results: pending } = await env.DB.prepare('SELECT id, text FROM social_posts WHERE classified = 0 ORDER BY published_at DESC LIMIT ?').bind(MAX_CLASSIFY_PER_PULL).all();
    let tagged = 0, aiFailures = 0;
    const update = env.DB.prepare('UPDATE social_posts SET sector = ?, party = ?, sentiment = ?, audience = ?, classified = 1 WHERE id = ?');
    for (let i = 0; i < pending.length; i += BATCH) {
        const batch = pending.slice(i, i + BATCH);
        try {
            const tags = await classify(env, batch, 'social media comments and posts');
            await env.DB.batch(batch.map((it, j) => update.bind(tags[j].sector, tags[j].party, tags[j].sentiment, tags[j].audience, it.id)));
            tagged += batch.length;
        } catch (e) {
            aiFailures++;
            console.error('social classify failed', e && e.message);
        }
    }

    await env.DB.prepare('DELETE FROM social_posts WHERE published_at < ?').bind(cutoff).run();
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM social_posts WHERE classified = 0').first();
    return json({ ok: true, configured: true, status, newPosts, tagged, untaggedRemaining: left.n, aiFailures });
}

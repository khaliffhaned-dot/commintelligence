// Semantic (meaning-based) search over stored articles: Workers AI multilingual embeddings + Vectorize.
// bge-m3 understands English, Malay, Chinese and Tamil, so a query in one language can find stories in another.
import { runAI } from './airun.js';

const EMBED_MODEL = '@cf/baai/bge-m3'; // 1024 dimensions, matches the commet-news index
const MIN_SCORE = 0.4;                 // below this a match is more noise than signal

export const semanticAvailable = (env) => !!(env.VECTORIZE && env.AI);

export async function embedTexts(env, texts) {
    const out = await runAI(env, EMBED_MODEL, { text: texts }, 86400);
    if (!out || !Array.isArray(out.data)) throw new Error('embedding model returned no data');
    return out.data;
}

/** Embeds and stores any articles that are not yet in the index. Returns how many were added. */
export async function embedPending(env, limit = 160) {
    if (!semanticAvailable(env)) return 0;
    const { results } = await env.DB.prepare('SELECT id, title, published_at FROM items WHERE embedded = 0 ORDER BY published_at DESC LIMIT ?').bind(limit).all();
    let added = 0;
    for (let i = 0; i < results.length; i += 32) {
        const batch = results.slice(i, i + 32);
        const vectors = await embedTexts(env, batch.map((r) => r.title));
        await env.VECTORIZE.upsert(batch.map((r, j) => ({ id: r.id, values: vectors[j], metadata: { p: r.published_at } })));
        const mark = env.DB.prepare('UPDATE items SET embedded = 1 WHERE id = ?');
        await env.DB.batch(batch.map((r) => mark.bind(r.id)));
        added += batch.length;
    }
    return added;
}

/** Most similar stored articles to a query, with a 0-1 similarity score. */
export async function semanticSearch(env, query, topK = 20, minScore = MIN_SCORE, diag = null) {
    if (!semanticAvailable(env)) return [];
    const [vec] = await embedTexts(env, [query]);
    const res = await env.VECTORIZE.query(vec, { topK, returnMetadata: 'none' });
    if (diag) { diag.raw = (res.matches || []).length; diag.topScore = res.matches && res.matches[0] ? res.matches[0].score : null; }
    const matches = (res.matches || []).filter((m) => m.score >= minScore);
    if (!matches.length) return [];
    const ids = matches.map((m) => m.id);
    const { results } = await env.DB.prepare(
        `SELECT id, title, url, source, published_at AS publishedAt, sentiment, sector, party FROM items WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const byId = new Map(results.map((r) => [r.id, r]));
    return matches.filter((m) => byId.has(m.id)).map((m) => ({ ...byId.get(m.id), score: Math.round(m.score * 100) / 100 }));
}

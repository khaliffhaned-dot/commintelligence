import { json } from '../_lib/intel.js';
import { semanticSearch, semanticAvailable } from '../_lib/semantic.js';
import { track } from '../_lib/metrics.js';

// GET /api/semantic?q=...  -> stored articles related to the query by meaning (any supported language).
export async function onRequestGet({ request, env, data }) {
    const q = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 200);
    if (q.length < 2) return json({ error: 'Enter at least 2 characters.' }, 400);
    if (!semanticAvailable(env)) return json({ available: false, items: [] });
    try {
        const t0 = Date.now();
        const items = await semanticSearch(env, q, 20);
        track(env, 'semantic_search', [], [items.length, Date.now() - t0], data && data.auth ? data.auth.org.id : 'system');
        return json({ available: true, items }, 200, { 'Cache-Control': 'no-store' });
    } catch (e) {
        console.error('semantic search failed', e && e.message);
        return json({ available: false, items: [], error: 'Semantic search is temporarily unavailable.' });
    }
}

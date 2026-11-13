import { json } from '../_lib/intel.js';
import { onRequestGet as buildReport } from './report.js';
import { track } from '../_lib/metrics.js';

// Barcelona Principle 7 (transparency): keep a dated, tamper-evident record of each report in R2, per organisation.
//   POST /api/snapshots            -> saves today's measurement report (built on the server, not supplied by the browser)
//   GET  /api/snapshots            -> lists this organisation's snapshots
//   GET  /api/snapshots?key=...    -> returns one snapshot (only if it belongs to this organisation)

export async function onRequestPost(ctx) {
    const { env, data } = ctx;
    if (!env.REPORTS) return json({ error: 'Report storage is not enabled.' }, 500);
    const orgId = data.auth.org.id;

    const res = await buildReport({ request: new Request('https://internal/api/report?days=30'), env, data });
    const report = await res.json();
    if (report.error) return json({ error: report.error }, 500);

    const now = new Date();
    const key = `${orgId}/${now.toISOString().replace(/[:.]/g, '-')}.json`;
    const body = JSON.stringify({ savedAt: now.toISOString(), organisation: data.auth.org.name, savedBy: data.auth.user.email, report }, null, 2);
    await env.REPORTS.put(key, body, { httpMetadata: { contentType: 'application/json' }, customMetadata: { articles: String(report.outputs.articles), objectivesMet: String(report.impact.met), objectivesTotal: String(report.impact.total) } });
    track(env, 'snapshot_saved', [], [body.length], orgId);
    return json({ ok: true, key });
}

export async function onRequestGet({ request, env, data }) {
    if (!env.REPORTS) return json({ error: 'Report storage is not enabled.' }, 500);
    const orgId = data.auth.org.id;
    const key = new URL(request.url).searchParams.get('key');

    if (key) {
        if (!key.startsWith(`${orgId}/`) || key.includes('..')) return json({ error: 'Not found.' }, 404);
        const obj = await env.REPORTS.get(key);
        if (!obj) return json({ error: 'Not found.' }, 404);
        return new Response(obj.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }

    const listed = await env.REPORTS.list({ prefix: `${orgId}/`, limit: 100, include: ['customMetadata'] });
    const snapshots = listed.objects.map((o) => ({
        key: o.key, savedAt: o.uploaded, size: o.size,
        articles: Number((o.customMetadata || {}).articles || 0),
        objectivesMet: Number((o.customMetadata || {}).objectivesMet || 0),
        objectivesTotal: Number((o.customMetadata || {}).objectivesTotal || 0),
    })).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    return json({ snapshots }, 200, { 'Cache-Control': 'no-store' });
}

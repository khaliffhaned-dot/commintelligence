// Shared AI endpoint for every generator module. Cloudflare Workers AI, no API keys.
// Hardened: sign-in required (middleware), per-organisation rate limit, size caps, grounding in real stored
// headlines, one automatic retry on invalid JSON, and AI Gateway caching/logging when available.
import { json, extractJson } from '../_lib/intel.js';
import { allowAttempt } from '../_lib/auth.js';
import { runAI } from '../_lib/airun.js';

const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const MAX_PROMPT_CHARS = 20000;
const MAX_IMAGE_BASE64_CHARS = 6000000; // about 4.5 MB
const RATE_PER_ORG_PER_HOUR = 120;

// Words from the prompt's boilerplate that would only retrieve irrelevant headlines.
const STOP = new Set(['return', 'valid', 'object', 'objects', 'following', 'string', 'strings', 'array', 'integer', 'integers', 'generate', 'please', 'should',
    'provide', 'include', 'using', 'about', 'their', 'which', 'these', 'those', 'would', 'could', 'there', 'where', 'analysis', 'analyze', 'report', 'based',
    'example', 'single', 'brief', 'short', 'short', 'concise', 'detailed', 'paragraph', 'keys', 'structure', 'exactly', 'each', 'with', 'plausible', 'realistic',
    'current', 'recent', 'malaysia', 'malaysian', 'strategy', 'sentiment', 'overall', 'summary', 'context', 'response', 'items', 'list', 'write', 'create', 'from', 'that', 'this', 'with', 'have', 'will', 'your', 'make', 'keys', 'into', 'than', 'then', 'them', 'such', 'also', 'only', 'more', 'most', 'some', 'were', 'what', 'when', 'must', 'been', 'does', 'each', 'long', 'text', 'name', 'type', 'case', 'role', 'plan', 'data', 'high', 'good', 'like', 'main', 'next', 'time', 'user', 'view']);

/** Recent real headlines relevant to the prompt (keyword matches first, then the newest), so generated text can lean on facts. */
async function groundingHeadlines(env, prompt) {
    const words = [...new Set(prompt.toLowerCase().match(/[a-z]{4,}/g) || [])].filter((w) => !STOP.has(w)).slice(0, 6);
    const rows = [];
    if (words.length) {
        const where = words.map(() => 'LOWER(title) LIKE ?').join(' OR ');
        const r = await env.DB.prepare(`SELECT title, source, published_at FROM items WHERE ${where} ORDER BY published_at DESC LIMIT 10`)
            .bind(...words.map((w) => `%${w}%`)).all();
        rows.push(...r.results);
    }
    const latest = await env.DB.prepare('SELECT title, source, published_at FROM items ORDER BY published_at DESC LIMIT 10').all();
    rows.push(...latest.results);
    const seen = new Set();
    return rows.filter((r) => !seen.has(r.title) && seen.add(r.title)).slice(0, 16);
}

const ymd = (s) => new Date(s * 1000).toISOString().slice(0, 10);

/**
 * POST /api/ai
 * Request:  { prompt: string, imageParts?: { mimeType, data }[] }
 * Response: { result: object, grounded: number } or { error: string }
 */
export async function onRequestPost({ request, env, data }) {
    if (!env.AI) return json({ error: 'Workers AI is not bound. Check wrangler.jsonc (ai.binding = "AI").' }, 500);

    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'Request body must be JSON.' }, 400); }
    const { prompt, imageParts } = payload || {};
    if (!prompt || typeof prompt !== 'string') return json({ error: 'Missing or invalid "prompt" in request.' }, 400);
    if (prompt.length > MAX_PROMPT_CHARS) return json({ error: 'That request is too long. Shorten the input and try again.' }, 413);

    const isVision = Array.isArray(imageParts) && imageParts.length > 0;
    if (isVision && String(imageParts[0].data || '').length > MAX_IMAGE_BASE64_CHARS) return json({ error: 'That image is too large (limit about 4.5 MB).' }, 413);

    // Protect the AI budget: a cap per organisation per hour.
    const orgId = data && data.auth ? data.auth.org.id : 'anon';
    if (!(await allowAttempt(env, `ai:${orgId}`, RATE_PER_ORG_PER_HOUR, 3600))) {
        return json({ error: `AI request limit reached (${RATE_PER_ORG_PER_HOUR} per hour). Try again later.` }, 429);
    }

    let grounding = [];
    try { grounding = await groundingHeadlines(env, prompt); } catch (e) { console.warn('grounding unavailable', e && e.message); }
    const groundingText = grounding.length
        ? `\n\nRecent real Malaysian headlines you may use as factual grounding (newest first):\n${grounding.map((g) => `- [${ymd(g.published_at)}] ${g.title} (${g.source})`).join('\n')}\nDo not invent facts, quotes, statistics, people or sources. If these headlines do not cover the topic, keep claims general and say coverage is limited.`
        : '';
    const system = 'You are a careful communications analyst for Malaysia. Reply with a single valid JSON object only: no markdown, no commentary.' + groundingText;

    const callModel = async (extraUser) => {
        const messages = [{ role: 'system', content: system }, { role: 'user', content: prompt + (extraUser || '') }];
        let out;
        if (isVision) {
            const img = imageParts[0]; // the vision model takes one image
            out = await runAI(env, env.AI_VISION_MODEL || DEFAULT_VISION_MODEL, { messages, image: `data:${img.mimeType};base64,${img.data}`, max_tokens: 2048 });
        } else {
            out = await runAI(env, env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL, { messages, max_tokens: 2048 });
        }
        return out && out.response !== undefined ? out.response : out;
    };

    try {
        let raw = await callModel();
        if (raw && typeof raw === 'object') return json({ result: raw, grounded: grounding.length });
        try {
            return json({ result: extractJson(raw), grounded: grounding.length });
        } catch {
            // One automatic retry with a firmer instruction before giving up.
            raw = await callModel('\n\nYour previous reply was not valid JSON. Reply again with ONLY the JSON object.');
            if (raw && typeof raw === 'object') return json({ result: raw, grounded: grounding.length });
            return json({ result: extractJson(raw), grounded: grounding.length });
        }
    } catch (e) {
        console.error('Workers AI error', e && e.message);
        return json({ error: 'The AI request failed or returned invalid output. Please try again; if it keeps happening the daily AI allowance may be used up.' }, 502);
    }
}

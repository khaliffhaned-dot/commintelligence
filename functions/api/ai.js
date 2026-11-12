// Cloudflare Workers AI backend. Needs the `AI` binding (see wrangler.jsonc); no API keys.
// Override models with Pages variables AI_TEXT_MODEL / AI_VISION_MODEL if desired.
const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Pull the first JSON object out of a model reply (handles ```json fences and extra prose).
function extractJson(text) {
    const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object');
    return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * POST /api/ai
 * Request:  { prompt: string, imageParts?: { mimeType, data }[] }
 * Response: { result: object } or { error: string }
 */
export async function onRequestPost({ request, env }) {
    if (!env.AI) {
        return json({ error: 'Workers AI is not bound. Deploy with wrangler.jsonc (ai.binding = "AI") or add a Workers AI binding named AI in the Pages dashboard.' }, 500);
    }

    let payload;
    try {
        payload = await request.json();
    } catch {
        return json({ error: 'Request body must be JSON.' }, 400);
    }
    const { prompt, imageParts } = payload || {};
    if (!prompt || typeof prompt !== 'string') {
        return json({ error: 'Missing or invalid "prompt" in request.' }, 400);
    }

    const messages = [
        { role: 'system', content: 'You are an analyst. Reply with a single valid JSON object only: no markdown, no commentary.' },
        { role: 'user', content: prompt },
    ];

    const isVision = Array.isArray(imageParts) && imageParts.length > 0;
    let out;
    try {
        if (isVision) {
            const img = imageParts[0]; // the vision model takes one image
            out = await env.AI.run(env.AI_VISION_MODEL || DEFAULT_VISION_MODEL, {
                messages,
                image: `data:${img.mimeType};base64,${img.data}`,
                max_tokens: 2048,
            });
        } else {
            out = await env.AI.run(env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL, { messages, max_tokens: 2048 });
        }
    } catch (e) {
        console.error('Workers AI error', e && e.message);
        return json({ error: 'Workers AI request failed. See the function logs; the model may need its license accepted or the daily free allowance may be used up.' }, 502);
    }

    // Some models return an already-parsed object, others a string in `response`.
    const raw = out && out.response !== undefined ? out.response : out;
    if (raw && typeof raw === 'object') return json({ result: raw });
    try {
        return json({ result: extractJson(raw) });
    } catch {
        return json({ error: 'The model did not return valid JSON.', raw: String(raw).slice(0, 500) }, 502);
    }
}

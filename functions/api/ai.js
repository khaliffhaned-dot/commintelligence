const DEFAULT_BASE_URL = 'https://tokenhub-intl.tencentcloudmaas.com/v1';const DEFAULT_MODEL = 'hy3-preview';

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Cloudflare Pages Function: POST /api/ai
 * Request:  { prompt: string, imageParts?: { mimeType, data }[] }
 * Response: { result: object } or { error: string }
 * HUNYUAN_API_KEY is a Pages secret and never reaches the browser.
 */
export async function onRequestPost({ request, env }) {
    if (!env.HUNYUAN_API_KEY) {
        return json({ error: 'Server misconfiguration: HUNYUAN_API_KEY is not set on this Pages project.' }, 500);
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

    const isVision = Array.isArray(imageParts) && imageParts.length > 0;
    const content = isVision
        ? [
            { type: 'text', text: prompt },
            ...imageParts.map((img) => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            })),
        ]
        : prompt;

    let response;
    try {
        response = await fetch(`${(env.HUNYUAN_BASE_URL || DEFAULT_BASE_URL).replace(//$/, '')}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.HUNYUAN_API_KEY}` },
            body: JSON.stringify({
                model: (isVision ? env.HUNYUAN_VISION_MODEL : env.HUNYUAN_TEXT_MODEL) || DEFAULT_MODEL,
                messages: [{ role: 'user', content }],
                response_format: { type: 'json_object' },
            }),
        });
    } catch (e) {
        return json({ error: `Failed to reach Hunyuan API: ${e.message}` }, 502);
    }
    if (!response.ok) {
        console.error('Hunyuan error', response.status, await response.text());
        return json({ error: `Hunyuan API error (HTTP ${response.status}). Check HUNYUAN_API_KEY, HUNYUAN_BASE_URL and the model name.` }, 502);
    }

    const data = await response.json();
    let text = (data.choices?.[0]?.message?.content || '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    try {
        return json({ result: JSON.parse(text) });
    } catch {
        return json({ error: 'Hunyuan returned a response that was not valid JSON.', raw: text }, 502);
    }
}

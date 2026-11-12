const HUNYUAN_CHAT_URL = 'https://hunyuan.cloud.tencent.com/openai/v1/chat/completions';
const TEXT_MODEL = 'hunyuan-turbo';
const VISION_MODEL = 'hunyuan-vision';

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
        response = await fetch(HUNYUAN_CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.HUNYUAN_API_KEY}` },
            body: JSON.stringify({
                model: isVision ? VISION_MODEL : TEXT_MODEL,
                messages: [{ role: 'user', content }],
                response_format: { type: 'json_object' },
            }),
        });
    } catch (e) {
        return json({ error: `Failed to reach Hunyuan API: ${e.message}` }, 502);
    }
    if (!response.ok) {
        return json({ error: `Hunyuan API error (${response.status}): ${await response.text()}` }, 502);
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

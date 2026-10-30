const HUNYUAN_CHAT_URL = 'https://hunyuan.cloud.tencent.com/openai/v1/chat/completions';
const HUNYUAN_TEXT_MODEL = 'hunyuan-turbo';
const HUNYUAN_VISION_MODEL = 'hunyuan-vision';

/**
 * CloudBase cloud function that proxies chat-completion requests to Tencent Hunyuan.
 * The Hunyuan API key lives only in this function's server-side environment variables
 * (set via the CloudBase console or `tcb fn config env`), never in the client bundle.
 *
 * Request payload: { prompt: string, imageParts?: { mimeType: string, data: string }[] }
 * Response: { result: object } on success, or { error: string } on failure.
 */
exports.main = async (event) => {
    const { prompt, imageParts } = event || {};

    if (!prompt || typeof prompt !== 'string') {
        return { error: 'Missing or invalid "prompt" in request.' };
    }

    const apiKey = process.env.HUNYUAN_API_KEY;
    if (!apiKey) {
        return { error: 'Server misconfiguration: HUNYUAN_API_KEY environment variable is not set on this function.' };
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: isVision ? HUNYUAN_VISION_MODEL : HUNYUAN_TEXT_MODEL,
                messages: [{ role: 'user', content }],
                response_format: { type: 'json_object' },
            }),
        });
    } catch (e) {
        return { error: `Failed to reach Hunyuan API: ${e.message}` };
    }

    if (!response.ok) {
        const errText = await response.text();
        return { error: `Hunyuan API error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    let text = (data.choices?.[0]?.message?.content || '').trim();
    if (text.startsWith('```json')) {
        text = text.substring(7, text.length - 3).trim();
    } else if (text.startsWith('```')) {
        text = text.substring(3, text.length - 3).trim();
    }

    try {
        return { result: JSON.parse(text) };
    } catch (e) {
        return { error: 'Hunyuan returned a response that was not valid JSON.', raw: text };
    }
};

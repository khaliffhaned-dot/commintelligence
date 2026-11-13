// One place that calls Workers AI. If a Cloudflare AI Gateway is available it adds response caching, logging and
// analytics; if the gateway is not set up, the call quietly continues without it so nothing breaks.
let gatewayState = 'unknown'; // unknown | on | off  (remembered for the life of this isolate)

export async function runAI(env, model, input, cacheTtlSeconds = 600) {
    if (gatewayState !== 'off') {
        try {
            const out = await env.AI.run(model, input, { gateway: { id: env.AI_GATEWAY_ID || 'default', cacheTtl: cacheTtlSeconds } });
            gatewayState = 'on';
            return out;
        } catch (e) {
            if (gatewayState === 'on') throw e; // the gateway works, so this is a real model error
            gatewayState = 'off';
            console.warn('AI Gateway unavailable, continuing without it:', e && e.message);
        }
    }
    return env.AI.run(model, input);
}

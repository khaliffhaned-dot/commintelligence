import { SECTORS, PARTIES, SENTIMENTS, AUDIENCES, extractJson } from './intel.js';
import { runAI } from './airun.js';

const TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Tags a batch of short texts (headlines, comments, posts) with sector, party, sentiment and stakeholder audience.
 * `batch` is an array of { text }. Returns one tag object per input, with null for anything the model got wrong.
 */
export async function classify(env, batch, kind = 'news headlines') {
    const list = batch.map((it, i) => `${i}. ${String(it.text).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    const prompt = `Classify these Malaysian ${kind}. They may be in English, Malay, Chinese, Tamil or mixed ("rojak").
For each, return:
- "sector": one of ${JSON.stringify(SECTORS)}
- "party": the Malaysian political coalition the text is mainly about, one of ${JSON.stringify(PARTIES)} (BN, PH, PN, GPS, GRS, Other = another political party/figure, None = not political)
- "sentiment": tone toward the main subject, one of ${JSON.stringify(SENTIMENTS)}
- "audience": the stakeholder audience it chiefly concerns, one of ${JSON.stringify(AUDIENCES)}
Texts:
${list}
Return only JSON: {"results":[{"i":0,"sector":"...","party":"...","sentiment":"...","audience":"..."}]}`;
    const out = await runAI(env, env.AI_TEXT_MODEL || TEXT_MODEL, {
        messages: [
            { role: 'system', content: 'You are a precise media analyst for Malaysia. Reply with one valid JSON object only.' },
            { role: 'user', content: prompt },
        ],
        max_tokens: 2048,
    });
    const raw = out && out.response !== undefined ? out.response : out;
    const parsed = raw && typeof raw === 'object' ? raw : extractJson(raw);
    const results = Array.isArray(parsed.results) ? parsed.results : [];
    const byIndex = new Map(results.map((r) => [Number(r.i), r]));
    return batch.map((_, i) => {
        const r = byIndex.get(i) || {};
        return {
            sector: SECTORS.includes(r.sector) ? r.sector : null,
            party: PARTIES.includes(r.party) ? r.party : null,
            sentiment: SENTIMENTS.includes(r.sentiment) ? r.sentiment : null,
            audience: AUDIENCES.includes(r.audience) ? r.audience : null,
        };
    });
}

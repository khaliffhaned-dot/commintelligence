// Shared helpers for the Malaysia intel pipeline (Google News RSS -> Workers AI tagging -> D1).

export const SECTORS = [
    'Banking & Finance', 'Energy & Utilities', 'Plantation & Agriculture', 'Technology & Digital',
    'Telecom & Media', 'Property & Construction', 'Manufacturing & Trade', 'Healthcare',
    'Education', 'Transport & Logistics', 'Retail & Consumer', 'Tourism & Hospitality',
    'Environment & Climate', 'Politics & Government', 'Other',
];
export const PARTIES = ['BN', 'PH', 'PN', 'GPS', 'GRS', 'Other', 'None'];
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];
// Barcelona Principle 2: the stakeholder audience a story chiefly concerns or addresses.
export const AUDIENCES = ['Government & Regulators', 'Business & Industry', 'Investors & Markets', 'Consumers & Public', 'Civil Society & NGOs', 'Workforce & Unions', 'General public interest'];
export const METRICS = {
    volume: 'Coverage volume (articles)',
    positive_share: 'Positive share of coverage (%)',
    negative_share: 'Negative share of coverage (%)',
    net_sentiment: 'Net sentiment (-100 to +100)',
    share_of_voice: 'Share of voice (%)',
};

// Direct outlet feeds (Google News RSS returns HTTP 503 to Cloudflare's shared IPs). Sector/party are AI-tagged.
export const FEEDS = [
    { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/feed' },
    { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/category/nation/feed' },
    { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/category/business/feed' },
    { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/category/highlight/feed' },
    { name: 'New Straits Times', url: 'https://www.nst.com.my/feed' },
    { name: 'Malaysiakini', url: 'https://www.malaysiakini.com/rss/en/news.rss' },
];

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
const unwrap = (s) => decode(s.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim());
const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? unwrap(m[1]) : '';
};

export function parseRss(xml, limit = 10, defaultSource = 'Unknown') {
    const out = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const block = m[1];
        const source = tag(block, 'source');
        let title = tag(block, 'title');
        if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
        const url = tag(block, 'link');
        const published = Date.parse(tag(block, 'pubDate'));
        if (!title || !url || Number.isNaN(published)) continue;
        out.push({ title, url, source: source || defaultSource, publishedAt: Math.floor(published / 1000) });
        if (out.length >= limit) break;
    }
    return out;
}

export async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extractJson(text) {
    const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s === -1 || e <= s) throw new Error('no JSON object');
    return JSON.parse(cleaned.slice(s, e + 1));
}

export const json = (body, status = 200, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

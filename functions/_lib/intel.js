// Shared helpers for the Malaysia intel pipeline (Google News RSS -> Workers AI tagging -> D1).

export const SECTORS = [
    'Banking & Finance', 'Energy & Utilities', 'Plantation & Agriculture', 'Technology & Digital',
    'Telecom & Media', 'Property & Construction', 'Manufacturing & Trade', 'Healthcare',
    'Education', 'Transport & Logistics', 'Retail & Consumer', 'Tourism & Hospitality',
    'Environment & Climate', 'Politics & Government', 'Other',
];
export const PARTIES = ['BN', 'PH', 'PN', 'GPS', 'GRS', 'Other', 'None'];
export const SENTIMENTS = ['Positive', 'Neutral', 'Negative'];

// Each query is one Google News RSS search, scoped to Malaysia and the last 2 days.
export const QUERIES = [
    { sector: 'Banking & Finance', q: '(bank OR "Bank Negara" OR ringgit OR "Bursa Malaysia")' },
    { sector: 'Energy & Utilities', q: '(Petronas OR TNB OR "oil and gas" OR "electricity tariff")' },
    { sector: 'Plantation & Agriculture', q: '("palm oil" OR plantation OR MPOB OR rubber OR agriculture)' },
    { sector: 'Technology & Digital', q: '(technology OR "data centre" OR AI OR cybersecurity OR semiconductor)' },
    { sector: 'Telecom & Media', q: '(telco OR 5G OR Maxis OR CelcomDigi OR "Telekom Malaysia")' },
    { sector: 'Property & Construction', q: '(property OR housing OR construction OR REIT)' },
    { sector: 'Manufacturing & Trade', q: '(manufacturing OR exports OR MITI OR tariff OR investment)' },
    { sector: 'Healthcare', q: '(healthcare OR hospital OR "Ministry of Health" OR pharmaceutical)' },
    { sector: 'Education', q: '(education OR university OR schools OR "Ministry of Education")' },
    { sector: 'Transport & Logistics', q: '(airline OR AirAsia OR port OR logistics OR rail OR MRT)' },
    { sector: 'Retail & Consumer', q: '(retail OR consumer OR "cost of living" OR subsidy OR e-commerce)' },
    { sector: 'Tourism & Hospitality', q: '(tourism OR hotel OR "Visit Malaysia")' },
    { sector: 'Environment & Climate', q: '(climate OR flood OR haze OR sustainability)' },
    { sector: 'Politics & Government', q: '(UMNO OR "Barisan Nasional")', party: 'BN' },
    { sector: 'Politics & Government', q: '(PKR OR DAP OR "Pakatan Harapan" OR Anwar)', party: 'PH' },
    { sector: 'Politics & Government', q: '(PAS OR Bersatu OR "Perikatan Nasional" OR Muhyiddin)', party: 'PN' },
    { sector: 'Politics & Government', q: '(GPS OR GRS OR Sarawak OR Sabah) politics' },
    { sector: 'Politics & Government', q: 'politics parliament Dewan Rakyat' },
];

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m]);
const unwrap = (s) => decode(s.replace(/^<!\[CDATA\[|\]\]>$/g, '').trim());
const tag = (block, name) => {
    const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
    return m ? unwrap(m[1]) : '';
};

export function rssUrl(q) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(`Malaysia ${q} when:2d`)}&hl=en-MY&gl=MY&ceid=MY:en`;
}

export function parseRss(xml, limit = 10) {
    const out = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const block = m[1];
        const source = tag(block, 'source');
        let title = tag(block, 'title');
        if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
        const url = tag(block, 'link');
        const published = Date.parse(tag(block, 'pubDate'));
        if (!title || !url || Number.isNaN(published)) continue;
        out.push({ title, url, source: source || 'Unknown', publishedAt: Math.floor(published / 1000) });
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

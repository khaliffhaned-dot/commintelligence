// Metric computation for Barcelona-Principles-style objectives. Everything is derived from stored, tagged coverage.
const POLITICAL_PARTIES = ['BN', 'PH', 'PN', 'GPS', 'GRS'];

/** Counts coverage matching an objective's filters over its window, plus the denominator for share of voice. */
export async function computeObjective(db, obj) {
    const since = Math.floor(Date.now() / 1000) - obj.days * 86400;
    const where = ['published_at >= ?', 'classified = 1'];
    const args = [since];
    if (obj.party) { where.push('party = ?'); args.push(obj.party); }
    if (obj.sector) { where.push('sector = ?'); args.push(obj.sector); }
    if (obj.audience) { where.push('audience = ?'); args.push(obj.audience); }

    const row = await db.prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN sentiment = 'Positive' THEN 1 ELSE 0 END) AS pos,
                SUM(CASE WHEN sentiment = 'Negative' THEN 1 ELSE 0 END) AS neg
         FROM items WHERE ${where.join(' AND ')}`,
    ).bind(...args).first();
    const n = row.n || 0, pos = row.pos || 0, neg = row.neg || 0;

    // Share of voice: matching coverage vs all tagged coverage in the same scope.
    let denominator = n;
    if (obj.metric === 'share_of_voice') {
        const scope = obj.party ? `AND party IN (${POLITICAL_PARTIES.map(() => '?').join(',')})` : '';
        const d = await db.prepare(`SELECT COUNT(*) AS n FROM items WHERE published_at >= ? AND classified = 1 ${scope}`)
            .bind(since, ...(obj.party ? POLITICAL_PARTIES : [])).first();
        denominator = d.n || 0;
    }

    let value = null;
    if (obj.metric === 'volume') value = n;
    else if (n > 0) {
        if (obj.metric === 'positive_share') value = (pos / n) * 100;
        else if (obj.metric === 'negative_share') value = (neg / n) * 100;
        else if (obj.metric === 'net_sentiment') value = ((pos - neg) / n) * 100;
        else if (obj.metric === 'share_of_voice') value = denominator ? (n / denominator) * 100 : null;
    }
    if (value !== null) value = Math.round(value * 10) / 10;

    return { value, sampleSize: n, status: statusFor(obj, value) };
}

export function statusFor(obj, value) {
    if (value === null) return 'No data';
    const slack = Math.max(Math.abs(obj.target) * 0.3, 5);
    if (obj.comparator === 'atleast') return value >= obj.target ? 'Met' : value >= obj.target - slack ? 'On track' : 'Behind';
    return value <= obj.target ? 'Met' : value <= obj.target + slack ? 'On track' : 'Behind';
}

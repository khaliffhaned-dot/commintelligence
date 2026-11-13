// Official-API collectors for YouTube comments and Reddit. Both are off until credentials are set as Pages secrets.
// No author names are read or stored.

export const clean = (s, n = 300) => String(s || '')
    .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim().slice(0, n);

export const youtubeConfigured = (env) => !!(env.YOUTUBE_API_KEY && (env.YOUTUBE_CHANNEL_HANDLES || '').trim());
export const redditConfigured = (env) => !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET);

async function yt(path, key) {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}${path.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`YouTube API ${res.status}: ${(body.error && body.error.message) || 'request failed'}`.replace(key, '***'));
    return body;
}

/** Newest comments on the latest videos of each configured channel handle. Quota: about 1 unit per call. */
export async function fetchYouTube(env) {
    if (!youtubeConfigured(env)) return { configured: false, posts: [], errors: [] };
    const key = env.YOUTUBE_API_KEY;
    const handles = env.YOUTUBE_CHANNEL_HANDLES.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8);
    const posts = [], errors = [];

    await Promise.all(handles.map(async (handle) => {
        try {
            const at = handle.startsWith('@') ? handle : `@${handle}`;
            const meta = async (k) => (await env.DB.prepare('SELECT value FROM meta WHERE key = ?').bind(k).first())?.value;
            let uploads = await meta(`yt_uploads:${at}`), label = await meta(`yt_label:${at}`);
            if (!uploads) {
                const r = await yt(`channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(at)}`, key);
                const ch = r.items && r.items[0];
                if (!ch) throw new Error('channel not found');
                uploads = ch.contentDetails.relatedPlaylists.uploads;
                label = ch.snippet.title;
                await env.DB.batch([
                    env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(`yt_uploads:${at}`, uploads),
                    env.DB.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(`yt_label:${at}`, label),
                ]);
            }
            const vids = await yt(`playlistItems?part=snippet&maxResults=3&playlistId=${encodeURIComponent(uploads)}`, key);
            for (const v of vids.items || []) {
                const videoId = v.snippet && v.snippet.resourceId && v.snippet.resourceId.videoId;
                if (!videoId) continue;
                try {
                    const c = await yt(`commentThreads?part=snippet&videoId=${encodeURIComponent(videoId)}&maxResults=20&order=time&textFormat=plainText`, key);
                    for (const it of c.items || []) {
                        const sn = it.snippet && it.snippet.topLevelComment && it.snippet.topLevelComment.snippet;
                        if (!sn || !sn.textDisplay) continue;
                        posts.push({
                            id: `yt:${it.id}`, channel: 'youtube', text: clean(sn.textDisplay),
                            url: `https://www.youtube.com/watch?v=${videoId}&lc=${it.id}`,
                            publishedAt: Math.floor(Date.parse(sn.publishedAt) / 1000),
                            label: `${label} · ${clean(v.snippet.title, 80)}`, score: sn.likeCount || 0,
                        });
                    }
                } catch (e) {
                    errors.push(`${at} video: ${e.message}`); // e.g. comments disabled on that video
                }
            }
        } catch (e) {
            errors.push(`${handle}: ${e.message}`);
        }
    }));
    return { configured: true, posts, errors: [...new Set(errors)].slice(0, 4) };
}

/** Newest posts from configured subreddits via app-only OAuth. Check Reddit's current Data API terms for commercial use. */
export async function fetchReddit(env) {
    if (!redditConfigured(env)) return { configured: false, posts: [], errors: [] };
    const ua = env.REDDIT_USER_AGENT || 'web:commet-intel:1.0';
    const subs = (env.REDDIT_SUBREDDITS || 'malaysia').split(',').map((s) => s.trim().replace(/^r\//, '')).filter(Boolean).slice(0, 3);
    const posts = [], errors = [];
    try {
        const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: { Authorization: `Basic ${btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`)}`, 'User-Agent': ua, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'grant_type=client_credentials',
        });
        const tok = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tok.access_token) throw new Error(`Reddit auth failed (${tokenRes.status})`);
        for (const sub of subs) {
            try {
                const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/new?limit=50&raw_json=1`, { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': ua } });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const body = await res.json();
                for (const c of (body.data && body.data.children) || []) {
                    const d = c.data;
                    if (!d || d.over_18 || d.stickied) continue;
                    posts.push({
                        id: `rd:${d.id}`, channel: 'reddit', text: clean(d.selftext ? `${d.title} — ${d.selftext}` : d.title, 400),
                        url: `https://www.reddit.com${d.permalink}`, publishedAt: Math.floor(d.created_utc), label: `r/${sub}`, score: d.score || 0,
                    });
                }
            } catch (e) {
                errors.push(`r/${sub}: ${e.message}`);
            }
        }
    } catch (e) {
        errors.push(e.message);
    }
    return { configured: true, posts, errors: [...new Set(errors)].slice(0, 4) };
}

import { sessionCookie, COOKIE_NAME, json } from '../../_lib/auth.js';
import { sha256 } from '../../_lib/intel.js';

// POST /api/auth/logout: ends the session server-side and clears the cookie.
export async function onRequestPost({ request, env }) {
    const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (m) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(m[1])).run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}

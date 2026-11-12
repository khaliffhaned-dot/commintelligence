import { getAuth, json } from '../../_lib/auth.js';

// GET /api/auth/me -> { authenticated, user, org, role }
export async function onRequestGet({ request, env }) {
    const auth = await getAuth(request, env);
    if (!auth) return json({ authenticated: false }, 200, { 'Cache-Control': 'no-store' });
    return json({ authenticated: true, ...auth }, 200, { 'Cache-Control': 'no-store' });
}

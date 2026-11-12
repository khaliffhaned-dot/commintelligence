import { getAuth, json } from '../_lib/auth.js';

// Runs before every /api/* route.
//  1. CSRF: state-changing requests must carry a custom header, which a cross-site form or image cannot send.
//  2. Auth: everything except /api/auth/* needs a valid session. The session is placed on context.data.auth.
export async function onRequest(context) {
    const { request, env, next, data } = context;
    const path = new URL(request.url).pathname;

    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.get('X-Requested-With') !== 'fetch') {
        return json({ error: 'Forbidden.' }, 403);
    }
    if (!env.DB) return json({ error: 'Missing D1 (DB) binding.' }, 500);

    if (path.startsWith('/api/auth/')) return next();

    const auth = await getAuth(request, env);
    if (!auth) return json({ error: 'Please sign in.' }, 401);
    data.auth = auth;
    return next();
}

import { verifyPassword, createSession, sessionCookie, SESSION_DAYS, allowAttempt, clientIp, validEmail, json } from '../../_lib/auth.js';

// POST /api/auth/login { email, password }
export async function onRequestPost({ request, env }) {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Body must be JSON.' }, 400); }
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    if (!validEmail(email) || !password || password.length > 200) return json({ error: 'Incorrect email or password.' }, 401);

    // Limit guessing per network address and per account.
    const ip = clientIp(request);
    if (!(await allowAttempt(env, `login-ip:${ip}`, 20, 900)) || !(await allowAttempt(env, `login-email:${email}`, 8, 900))) {
        return json({ error: 'Too many attempts. Wait 15 minutes and try again.' }, 429);
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const ok = await verifyPassword(password, user);
    if (!ok) return json({ error: 'Incorrect email or password.' }, 401);

    const membership = await env.DB.prepare(
        `SELECT o.id, o.name, m.role FROM memberships m JOIN orgs o ON o.id = m.org_id
         WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1`).bind(user.id).first();
    if (!membership) return json({ error: 'This account has no organisation.' }, 403);

    const token = await createSession(env, user.id, membership.id);
    return json({ ok: true, user: { email: user.email, name: user.name }, org: { id: membership.id, name: membership.name }, role: membership.role }, 200,
        { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

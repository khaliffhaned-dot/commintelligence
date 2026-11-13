import { hashPassword, createSession, sessionCookie, SESSION_DAYS, allowAttempt, clientIp, validEmail, pruneExpired, json } from '../../_lib/auth.js';

// POST /api/auth/signup { email, password, name, orgName, code? }
// Creates a user, a new organisation they own, and signs them in.
export async function onRequestPost({ request, env }) {
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Body must be JSON.' }, 400); }

    if (env.SIGNUP_CODE && b.code !== env.SIGNUP_CODE) return json({ error: 'A valid invite code is required to sign up.' }, 403);
    if (!(await allowAttempt(env, `signup:${clientIp(request)}`, 5, 3600))) {
        return json({ error: 'Too many sign-ups from this network. Try again later.' }, 429);
    }

    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const name = String(b.name || '').trim().slice(0, 80);
    const orgName = String(b.orgName || '').trim().slice(0, 80);
    if (!validEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);
    if (email.endsWith('@prvail.local')) return json({ error: 'That email domain is reserved.' }, 400);
    if (password.length < 10) return json({ error: 'Password must be at least 10 characters.' }, 400);
    if (password.length > 200) return json({ error: 'Password is too long.' }, 400);
    if (orgName.length < 2) return json({ error: 'Enter your organisation name.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return json({ error: 'An account with this email already exists. Try signing in.' }, 409);

    const now = Math.floor(Date.now() / 1000);
    const userId = crypto.randomUUID(), orgId = crypto.randomUUID();
    const { hash, salt } = await hashPassword(password);
    await env.DB.batch([
        env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt, created_at) VALUES (?,?,?,?,?,?)').bind(userId, email, name, hash, salt, now),
        env.DB.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)').bind(orgId, orgName, now),
        env.DB.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES (?,?,'owner')").bind(userId, orgId),
    ]);

    const token = await createSession(env, userId, orgId);
    await pruneExpired(env);
    return json({ ok: true, user: { email, name }, org: { id: orgId, name: orgName }, role: 'owner' }, 200,
        { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

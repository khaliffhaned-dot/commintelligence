import { hashPassword, createSession, sessionCookie, SESSION_DAYS, allowAttempt, clientIp, json } from '../../_lib/auth.js';
import { sha256 } from '../../_lib/intel.js';

const ADMIN_EMAIL = 'admin@prvail.local'; // reserved: ordinary sign-up refuses this domain

// POST /api/auth/admin { passcode }
// Quick access for the site owner. Disabled unless the ADMIN_PASSCODE secret is set.
// The session is remembered on the device for SESSION_DAYS days.
export async function onRequestPost({ request, env }) {
    if (!env.ADMIN_PASSCODE) return json({ error: 'Admin access is not enabled.' }, 404);

    let b;
    try { b = await request.json(); } catch { return json({ error: 'Body must be JSON.' }, 400); }
    const passcode = String(b.passcode || '');
    if (!passcode || passcode.length > 100) return json({ error: 'Incorrect passcode.' }, 401);

    // A short passcode can be guessed, so guessing is capped per network address AND across the whole site.
    if (!(await allowAttempt(env, `admin-ip:${clientIp(request)}`, 5, 900)) || !(await allowAttempt(env, 'admin-global', 30, 3600))) {
        return json({ error: 'Too many attempts. Try again later.' }, 429);
    }

    // Compare hashes so the comparison does not depend on where the strings first differ.
    const [given, wanted] = await Promise.all([sha256(passcode), sha256(String(env.ADMIN_PASSCODE))]);
    let diff = 0;
    for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ wanted.charCodeAt(i);
    if (diff !== 0) return json({ error: 'Incorrect passcode.' }, 401);

    // Find or create the admin account and its workspace. Its password is random and unknown, so it cannot sign in by email.
    let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(ADMIN_EMAIL).first();
    let org;
    if (!user) {
        const now = Math.floor(Date.now() / 1000);
        const userId = crypto.randomUUID(), orgId = crypto.randomUUID();
        const { hash, salt } = await hashPassword(crypto.randomUUID() + crypto.randomUUID());
        await env.DB.batch([
            env.DB.prepare('INSERT INTO users (id, email, name, password_hash, salt, created_at) VALUES (?,?,?,?,?,?)').bind(userId, ADMIN_EMAIL, 'Admin', hash, salt, now),
            env.DB.prepare('INSERT INTO orgs (id, name, created_at) VALUES (?,?,?)').bind(orgId, 'Admin Workspace', now),
            env.DB.prepare("INSERT INTO memberships (user_id, org_id, role) VALUES (?,?,'owner')").bind(userId, orgId),
        ]);
        user = { id: userId };
        org = { id: orgId, name: 'Admin Workspace' };
    } else {
        org = await env.DB.prepare('SELECT o.id, o.name FROM memberships m JOIN orgs o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.created_at LIMIT 1').bind(user.id).first();
    }

    const token = await createSession(env, user.id, org.id);
    return json({ ok: true, user: { email: ADMIN_EMAIL, name: 'Admin' }, org, role: 'owner' }, 200,
        { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

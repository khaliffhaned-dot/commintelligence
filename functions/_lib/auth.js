// Account/session helpers. Passwords: PBKDF2-SHA256 (WebCrypto). Sessions: random token in an HttpOnly cookie;
// only the SHA-256 of the token is stored in D1.
import { json, sha256 } from './intel.js';

const PBKDF2_ITERATIONS = 100000; // the Workers runtime maximum
export const SESSION_DAYS = 30;
export const COOKIE_NAME = 'session';

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

export async function hashPassword(password, saltHex) {
    const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
    return { hash: toHex(bits), salt: toHex(salt) };
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

export async function verifyPassword(password, user) {
    // A missing user still costs one hash, so response time does not reveal whether an email exists.
    const { hash } = await hashPassword(password, user ? user.salt : '00'.repeat(16));
    return !!user && timingSafeEqual(hash, user.password_hash);
}

export function newToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function sessionCookie(token, maxAgeSeconds) {
    return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

function readCookie(request, name) {
    const header = request.headers.get('Cookie') || '';
    for (const part of header.split(';')) {
        const [k, ...v] = part.trim().split('=');
        if (k === name) return v.join('=');
    }
    return null;
}

export async function createSession(env, userId, orgId) {
    const token = newToken();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, org_id, created_at, expires_at) VALUES (?,?,?,?,?)')
        .bind(await sha256(token), userId, orgId, now, now + SESSION_DAYS * 86400).run();
    return token;
}

/** Returns { user, org, role } for a valid session cookie, otherwise null. */
export async function getAuth(request, env) {
    const token = readCookie(request, COOKIE_NAME);
    if (!token) return null;
    const row = await env.DB.prepare(
        `SELECT u.id AS userId, u.email, u.name, o.id AS orgId, o.name AS orgName, m.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN orgs o ON o.id = s.org_id
         JOIN memberships m ON m.user_id = s.user_id AND m.org_id = s.org_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
    ).bind(await sha256(token), Math.floor(Date.now() / 1000)).first();
    if (!row) return null;
    return { user: { id: row.userId, email: row.email, name: row.name }, org: { id: row.orgId, name: row.orgName }, role: row.role };
}

/** Sliding-window limiter backed by D1. Returns true when the action is allowed. */
export async function allowAttempt(env, key, max, windowSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM auth_attempts WHERE key = ? AND ts > ?').bind(key, now - windowSeconds).first();
    if (n >= max) return false;
    await env.DB.prepare('INSERT INTO auth_attempts (key, ts) VALUES (?, ?)').bind(key, now).run();
    return true;
}

export async function pruneExpired(env) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
        env.DB.prepare('DELETE FROM auth_attempts WHERE ts <= ?').bind(now - 86400),
    ]);
}

export const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'unknown';
export const validEmail = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export { json };

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const origin = process.env.PUBLIC_ORIGIN || 'https://www.getyingyongjie.com';
export const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_COOKIE_SECRET);
export const callback = `${origin}/api/auth/google/callback`;
const cookieName = 'appstreet_google_session';
const stateCookie = 'appstreet_google_state';
const secret = () => process.env.AUTH_COOKIE_SECRET || '';
const b64 = (v) => Buffer.from(v).toString('base64url');
const signature = (v) => createHmac('sha256', secret()).update(v).digest('base64url');
export const random = () => randomBytes(32).toString('base64url');
export const stateCookieName = stateCookie;
export function signed(value) { return `${b64(JSON.stringify(value))}.${signature(b64(JSON.stringify(value)))}`; }
export function verify(value) {
  if (!value || !secret()) return null;
  const [payload, sig] = value.split('.'); if (!payload || !sig) return null;
  const expected = Buffer.from(signature(payload)); const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url')); return data.exp > Date.now() ? data : null; } catch { return null; }
}
export function getCookie(req, name) {
  const part = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}
export function setCookie(res, name, value, maxAge) {
  const item = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
  const current = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', [...(Array.isArray(current) ? current : current ? [current] : []), item]);
}
export function clearCookie(res, name) { setCookie(res, name, '', 0); }
export function redirect(res, url) { res.statusCode = 303; res.setHeader('Location', url); res.setHeader('Cache-Control', 'no-store'); res.end(); }

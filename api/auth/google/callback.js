import { configured, callback, getCookie, verify, clearCookie, setCookie, signed, redirect, stateCookieName } from '../_shared.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const pending = verify(getCookie(req, stateCookieName)); clearCookie(res, stateCookieName);
  if (!configured) return redirect(res, '/?feedback_auth=not_configured');
  if (!pending || !req.query.code || req.query.state !== pending.state) return redirect(res, '/?feedback_auth=invalid_state');
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: callback, grant_type: 'authorization_code' }) });
    const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.access_token) throw new Error('token');
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token.access_token}` } });
    const profile = await profileResponse.json(); if (!profileResponse.ok || !profile.email_verified || !profile.sub || !profile.email) throw new Error('profile');
    setCookie(res, 'appstreet_google_session', signed({ sub: profile.sub, email: profile.email, name: String(profile.name || '').slice(0, 100), exp: Date.now() + 7 * 86400000 }), 604800);
    return redirect(res, '/?feedback_auth=success');
  } catch { return redirect(res, '/?feedback_auth=connection_error'); }
}

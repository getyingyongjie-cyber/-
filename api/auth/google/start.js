import { configured, callback, random, signed, setCookie, redirect, stateCookieName } from '../_shared.js';
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!configured) return redirect(res, '/?feedback_auth=not_configured');
  const state = random(); setCookie(res, stateCookieName, signed({ state, exp: Date.now() + 300000 }), 300);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callback, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  return redirect(res, url.href);
}

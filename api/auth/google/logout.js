import { clearCookie, redirect } from '../_shared.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).end();
  clearCookie(res, 'appstreet_google_session');
  clearCookie(res, 'appstreet_google_state');
  return redirect(res, req.query?.feedback === '1' ? '/?feedback=1' : '/');
}

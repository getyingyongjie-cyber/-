import { configured, getCookie, verify } from './_shared.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const session = verify(getCookie(req, 'appstreet_google_session'));
  res.status(200).json({ provider: 'google', configured, authenticated: Boolean(session), user: session ? { id: session.sub, email: session.email, name: session.name } : null });
}

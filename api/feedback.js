import { origin, getCookie, verify, signed, setCookie } from './auth/_shared.js';

const RECIPIENT = 'getyingyongjie@gmail.com';
const COOLDOWN_COOKIE = 'appstreet_feedback_cooldown';
const compoundSurnames = ['欧阳', '司马', '上官', '诸葛', '夏侯', '东方', '皇甫', '尉迟', '公孙', '慕容', '令狐', '司徒', '司空', '南宫'];
const displayName = name => (compoundSurnames.find(s => name.startsWith(s)) || Array.from(name)[0] || '') + '****';

// Visitors use the existing sign-in cookie. Only the site owner's account sends email.
export function createFeedbackHandler({ fetchImpl = fetch, env = process.env, now = Date.now } = {}) {
  let token = null;
  const recent = new Map();
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const fail = (status, error) => res.status(status).json({ error });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return fail(405, 'method_not_allowed');
    }
    if (req.headers.origin !== origin || req.headers['sec-fetch-site'] === 'cross-site') return fail(403, 'invalid_origin');
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return fail(415, 'json_required');
    let user;
    try { user = verify(getCookie(req, 'appstreet_google_session')); } catch { return fail(401, 'login_required'); }
    if (!user?.sub || !/^[^\s<>@\r\n]+@[A-Za-z0-9.-]+$/.test(user.email || '')) return fail(401, 'login_required');
    let draft;
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw) > 16384) return fail(413, 'feedback_too_large');
      draft = JSON.parse(raw);
    } catch { return fail(400, 'invalid_feedback'); }
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return fail(400, 'invalid_feedback');
    const { name = '', content = '', rating = 0, named = true } = draft;
    if (typeof name !== 'string' || name.trim().length > 40 || typeof content !== 'string' || !content.trim() || content.trim().length > 1200 || typeof named !== 'boolean' || named && !name.trim() || !Number.isInteger(rating) || rating < 0 || rating > 5) return fail(400, 'invalid_feedback');
    let cooldown;
    try { cooldown = verify(getCookie(req, COOLDOWN_COOKIE)); } catch { /* Ignore malformed cooldown cookies. */ }
    const subject = String(user.sub);
    for (const [key, value] of recent) if (value.until <= now()) recent.delete(key);
    if (cooldown?.sub === subject || recent.has(subject)) {
      res.setHeader('Retry-After', '60');
      return fail(429, 'try_later');
    }
    const clientId = env.GOOGLE_FEEDBACK_CLIENT_ID;
    const clientSecret = env.GOOGLE_FEEDBACK_CLIENT_SECRET;
    const refreshToken = env.GMAIL_FEEDBACK_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) return fail(503, 'sender_not_configured');
    if (recent.size >= 1000) return fail(503, 'service_busy');
    recent.set(subject, { until: now() + 60000 });
    let sent = false;
    try {
      if (!token || token.expires <= now() + 30000) {
        const response = await fetchImpl('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
          signal: AbortSignal.timeout(8000)
        });
        const value = await response.json();
        if (!response.ok || typeof value.access_token !== 'string') return fail(503, 'sender_authorization_required');
        token = { value: value.access_token, expires: now() + Math.min(Number(value.expires_in) || 3600, 3600) * 1000 };
      }
      const text = [
        '应用街反馈建议',
        `署名：${named ? displayName(name.trim()) : '匿名用户'}`,
        `评分：${rating ? rating + '/5' : '未评分'}`,
        `联系邮箱：${user.email}`,
        '',
        content.trim()
      ].join('\r\n');
      const encodedBody = Buffer.from(text).toString('base64').match(/.{1,76}/g).join('\r\n');
      const mime = [
        `To: ${RECIPIENT}`,
        `Reply-To: ${user.email}`,
        'Subject: =?UTF-8?B?' + Buffer.from('应用街反馈建议').toString('base64') + '?=',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '', encodedBody
      ].join('\r\n');
      const response = await fetchImpl('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token.value, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }),
        signal: AbortSignal.timeout(12000)
      });
      const message = await response.json();
      if (!response.ok || !message.id) {
        if (response.status === 401) token = null;
        return fail(response.status === 401 || response.status === 403 ? 503 : 502, response.status === 401 || response.status === 403 ? 'sender_authorization_required' : 'send_failed');
      }
      sent = true;
      setCookie(res, COOLDOWN_COOKIE, signed({ sub: subject, exp: now() + 60000 }), 60);
      return res.status(200).json({ ok: true, messageId: message.id });
    } catch {
      return fail(502, 'send_unconfirmed');
    } finally {
      // Keep a short delay even after errors; a timed-out send may have succeeded.
      if (!sent) recent.set(subject, { until: now() + 60000 });
    }
  };
}

export default createFeedbackHandler();

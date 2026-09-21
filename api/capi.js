// Vercel Serverless Function — Meta Conversions API.
// Variáveis de ambiente (só no servidor): META_PIXEL_ID, META_ACCESS_TOKEN
// Opcionais: META_TEST_EVENT_CODE (testes no Events Manager), META_GRAPH_VERSION, ALLOWED_ORIGINS (lista separada por vírgulas)

const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'InitiateCheckout', 'Lead']);
const CUSTOM_KEYS = ['content_name', 'content_category', 'content_ids', 'content_type', 'value', 'currency'];

const str = (v, max = 500) => (typeof v === 'string' && v.length <= max ? v : '');

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // sendBeacon/same-origin sem cabeçalho Origin
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  if (host === req.headers.host) return true;
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .some((o) => o === origin || o === host);
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || undefined;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!originAllowed(req)) return res.status(403).json({ error: 'forbidden_origin' });

  const pixelId = (process.env.META_PIXEL_ID || '').trim();
  const token = (process.env.META_ACCESS_TOKEN || '').trim();
  if (!pixelId || !token) return res.status(503).json({ error: 'capi_not_configured' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'invalid_body' });

  const eventName = str(body.event_name, 50);
  if (!ALLOWED_EVENTS.has(eventName)) return res.status(400).json({ error: 'event_not_allowed' });

  const sourceUrl = str(body.event_source_url, 2000);
  if (!/^https?:\/\//i.test(sourceUrl)) return res.status(400).json({ error: 'invalid_source_url' });

  const custom = {};
  const cd = body.custom_data && typeof body.custom_data === 'object' ? body.custom_data : {};
  for (const k of CUSTOM_KEYS) if (cd[k] !== undefined) custom[k] = cd[k];

  const userData = {
    client_ip_address: clientIp(req),
    client_user_agent: str(req.headers['user-agent'], 500) || undefined
  };
  const fbp = str(body.fbp, 200);
  const fbc = str(body.fbc, 400);
  if (/^fb\.\d\./.test(fbp)) userData.fbp = fbp;
  if (/^fb\.\d\./.test(fbc)) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: str(body.event_id, 100) || undefined,
      action_source: 'website',
      event_source_url: sourceUrl,
      user_data: userData,
      custom_data: Object.keys(custom).length ? custom : undefined
    }],
    access_token: token
  };
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  const version = process.env.META_GRAPH_VERSION || 'v24.0';
  try {
    const r = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      console.error('Meta CAPI error', r.status, detail?.error?.message || '');
      return res.status(502).json({ error: 'meta_rejected' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Meta CAPI request failed', err?.message || err);
    return res.status(502).json({ error: 'meta_unreachable' });
  }
}

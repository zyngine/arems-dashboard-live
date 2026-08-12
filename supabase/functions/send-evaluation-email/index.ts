// Sends the "new evaluation" notification email.
//
// This lives server-side because the Resend API key cannot exist in the frontend.
// Create React App inlines everything into the JS bundle, so a REACT_APP_* variable
// would still ship the key to every visitor's browser -- it would hide the key from
// git without making it secret. The key is read here from the function's own
// environment and never leaves the server.
//
// Set the secret with:
//   supabase secrets set RESEND_API_KEY=re_xxx
// or in the dashboard under Edge Functions -> Manage secrets.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = 'AREMS Notifications <noreply@arems.net>';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const escapeHtml = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

interface Payload {
  to?: string;
  toName?: string;
  orienteeName?: string;
  evaluatorName?: string;
  shiftDate?: string;
  rating?: number;
}

const buildHtml = (p: Payload) => {
  const rating = Math.max(0, Math.min(5, Number(p.rating) || 0));
  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const formattedDate = p.shiftDate
    ? new Date(p.shiftDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
    .rating { font-size: 24px; color: #eab308; }
    .detail { margin: 10px 0; padding: 12px; background: white; border-radius: 8px; }
    .label { font-size: 12px; color: #64748b; text-transform: uppercase; }
    .value { font-size: 16px; font-weight: 600; color: #1e293b; }
    .footer { text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">New Evaluation Submitted</h1>
      <p style="margin:10px 0 0 0; opacity:0.9;">Adams Regional EMS Training</p>
    </div>
    <div class="content">
      <p>Hi ${escapeHtml(p.toName)},</p>
      <p>A new evaluation has been submitted for your orientee:</p>

      <div class="detail">
        <div class="label">Orientee</div>
        <div class="value">${escapeHtml(p.orienteeName)}</div>
      </div>

      <div class="detail">
        <div class="label">Evaluated By</div>
        <div class="value">${escapeHtml(p.evaluatorName)}</div>
      </div>

      <div class="detail">
        <div class="label">Shift Date</div>
        <div class="value">${escapeHtml(formattedDate)}</div>
      </div>

      <div class="detail">
        <div class="label">Overall Rating</div>
        <div class="value rating">${stars}</div>
      </div>

      <p style="margin-top:20px;">Log in to the AREMS dashboard to view the full evaluation details.</p>
    </div>
    <div class="footer">
      <p>Adams Regional EMS - Orientee Tracking System</p>
    </div>
  </div>
</body>
</html>`;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set on this function');
    return json({ error: 'Email is not configured on the server' }, 500);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!payload.to) return json({ error: 'Missing recipient' }, 400);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [payload.to],
        subject: `New Evaluation for ${payload.orienteeName ?? 'an orientee'}`,
        html: buildHtml(payload),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log server-side; do not echo provider errors back to the browser.
      console.error('Resend rejected the message', res.status, data);
      return json({ error: 'Email provider rejected the message' }, 502);
    }
    return json({ success: true, id: data?.id ?? null });
  } catch (e) {
    console.error('Email send failed', e);
    return json({ error: 'Email send failed' }, 500);
  }
});

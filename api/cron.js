import { getOfficialEvents } from './official.js';

const ARTISTS = ['くるり', 'Bialystocks'];
const DAY = 24 * 60 * 60 * 1000;

const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function upcomingSales(events) {
  const now = Date.now();
  const until = now + DAY;
  return events.filter(event => {
    const start = Date.parse(event.saleDate || '');
    return !Number.isNaN(start) && start >= now && start < until && event.status !== 'ended';
  });
}

function emailHtml(events) {
  const cards = events.map(event => `
    <div style="border:1px solid #ddd;border-radius:12px;padding:16px;margin:12px 0">
      <div style="color:#6d28d9;font-weight:bold">${escapeHtml(event.artist)}</div>
      <h2 style="font-size:18px;margin:6px 0">${escapeHtml(event.title)}</h2>
      <p><strong>販売開始：</strong>${escapeHtml(new Date(event.saleDate).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}</p>
      ${event.saleEndDate ? `<p><strong>受付終了：</strong>${escapeHtml(new Date(event.saleEndDate).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }))}</p>` : ''}
      <p><a href="${escapeHtml(event.url)}" style="display:inline-block;background:#111827;color:white;padding:10px 14px;border-radius:8px;text-decoration:none">公式・販売ページを開く</a></p>
    </div>`).join('');
  return `<div style="font-family:Arial,'Noto Sans JP',sans-serif;max-width:640px;margin:auto"><h1>LiveCue 販売開始アラート</h1><p>24時間以内に販売が始まるチケット情報があります。</p>${cards}<p style="color:#667085;font-size:12px">日時や販売条件は、購入前に必ず公式ページで再確認してください。</p></div>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = await Promise.all(ARTISTS.map(getOfficialEvents));
  const events = upcomingSales(results.flatMap(result => result.events || []));
  if (!events.length) return res.status(200).json({ checked: true, notified: 0, message: 'No sales starting in the next 24 hours' });

  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;
  if (!apiKey || !alertEmail) {
    return res.status(503).json({ error: 'RESEND_API_KEY or ALERT_EMAIL is not configured', candidates: events.length });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.ALERT_FROM || 'LiveCue <onboarding@resend.dev>',
      to: [alertEmail],
      subject: `【LiveCue】24時間以内に販売開始：${events.map(event => event.artist).join('・')}`,
      html: emailHtml(events)
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return res.status(response.status).json({ error: 'Email delivery failed', details: body });
  return res.status(200).json({ checked: true, notified: events.length, delivery: body.id || 'sent' });
}

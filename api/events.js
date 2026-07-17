const TM_ROOT = 'https://app.ticketmaster.com/discovery/v2/events.json';

function text(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeEvent(event, artist) {
  const venue = event?._embedded?.venues?.[0] || {};
  const sale = event?.sales?.public || {};
  const presales = Array.isArray(event?.sales?.presales) ? event.sales.presales : [];
  const earliestPresale = presales
    .filter(p => p?.startDateTime || p?.endDateTime)
    .sort((a, b) => text(a.startDateTime).localeCompare(text(b.startDateTime)))[0];

  let status = 'waiting';
  const now = Date.now();
  const saleStart = sale.startDateTime ? Date.parse(sale.startDateTime) : NaN;
  const saleEnd = sale.endDateTime ? Date.parse(sale.endDateTime) : NaN;
  if (earliestPresale?.startDateTime && Date.parse(earliestPresale.startDateTime) > now) status = 'soon';
  if (earliestPresale?.startDateTime && Date.parse(earliestPresale.startDateTime) <= now && (!earliestPresale.endDateTime || Date.parse(earliestPresale.endDateTime) >= now)) status = 'open';
  else if (!Number.isNaN(saleStart) && saleStart > now) status = 'soon';
  else if (!Number.isNaN(saleStart) && saleStart <= now && (Number.isNaN(saleEnd) || saleEnd >= now)) status = 'open';
  else if (!Number.isNaN(saleEnd) && saleEnd < now) status = 'ended';

  const saleLabel = earliestPresale
    ? (earliestPresale.name || '先行販売')
    : (sale.startDateTime ? '一般販売' : '販売情報');
  const saleDate = earliestPresale?.startDateTime || sale.startDateTime || '';
  const saleEndDate = earliestPresale?.endDateTime || sale.endDateTime || '';

  return {
    id: event.id,
    artist,
    title: text(event.name),
    venue: text(venue.name),
    city: text(venue.city?.name),
    liveDate: text(event.dates?.start?.localDate),
    liveTime: text(event.dates?.start?.localTime),
    saleLabel,
    saleDate,
    saleEndDate,
    status,
    url: text(event.url),
    source: 'Ticketmaster Discovery API'
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const artist = text(req.query.artist).trim();
  if (!artist) return res.status(400).json({ error: 'artist is required' });
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'TICKETMASTER_API_KEY is not configured' });

  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: artist,
    classificationName: 'music',
    countryCode: text(req.query.country || 'JP'),
    size: '30',
    sort: 'date,asc',
    locale: '*'
  });

  try {
    const response = await fetch(`${TM_ROOT}?${params.toString()}`);
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'Ticketmaster request failed', details: body });
    const raw = body?._embedded?.events || [];
    const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = raw.map(event => normalizeEvent(event, artist)).filter(event => !event.liveDate || event.liveDate >= todayJst);
    return res.status(200).json({ artist, count: events.length, events, checkedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: 'Could not fetch events', message: error.message });
  }
}

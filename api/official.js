import * as cheerio from 'cheerio';

const SOURCES = {
  'くるり': {
    artist: 'くるり',
    url: 'https://www.quruli.net/category/live',
    aliases: ['くるり', 'quruli'],
    kind: 'quruli'
  },
  bialystocks: {
    artist: 'Bialystocks',
    url: 'https://bialystocks.com/live/',
    aliases: ['bialystocks', 'ビアリストックス', 'biarystocks'],
    kind: 'generic'
  }
};

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const keyOf = value => clean(value).toLowerCase();

function sourceFor(name) {
  const key = keyOf(name);
  return Object.values(SOURCES).find(source => source.aliases.some(alias => key === alias));
}

function absolute(href, base) {
  try { return new URL(href || '', base).href; } catch { return base; }
}

function dateFrom(text) {
  const match = text.match(/(20\d{2})[\/.年-]\s*(\d{1,2})[\/.月-]\s*(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

function statusFrom(text) {
  return /受付中|販売中|発売中|一般発売開始/.test(text) ? 'open' : 'waiting';
}

function makeEvent(source, title, body, url, index) {
  const text = clean(body).slice(0, 700);
  const liveDate = dateFrom(`${title} ${text}`);
  return {
    id: `official-${source.artist}-${liveDate || 'news'}-${index}`,
    artist: source.artist,
    title: (clean(title) || `${source.artist} 公式ライブ情報`).slice(0, 160),
    venue: '',
    city: '',
    liveDate,
    liveTime: '',
    saleLabel: /先行/.test(text) ? '先行販売情報' : /一般/.test(text) ? '一般販売情報' : '公式ライブ情報',
    saleDate: '',
    saleEndDate: '',
    status: statusFrom(text),
    url: absolute(url, source.url),
    source: `${source.artist}公式サイト`,
    summary: text
  };
}

function parseQuruli($, source) {
  const result = [];
  $('h2').each((index, heading) => {
    const $heading = $(heading);
    let body = '';
    let title = clean($heading.text());
    let link = '';
    let node = $heading.next();
    while (node.length && !node.is('h2')) {
      if (!title && node.is('h3')) title = clean(node.text());
      body += ` ${clean(node.text())}`;
      if (!link) link = node.find('a[href]').first().attr('href') || '';
      node = node.next();
    }
    if (/20\d{2}[\/.年-]/.test(`${title} ${body}`)) result.push(makeEvent(source, title, body, link, index));
  });
  return result;
}

function parseGeneric($, source) {
  const selectors = 'article, .live-item, .live__item, .live_list li, .live-list li, .post, .entry';
  const nodes = $(selectors).toArray();
  const candidates = nodes.length ? nodes : $('main h2, main h3, main h4').toArray();
  return candidates.map((node, index) => {
    const $node = $(node);
    const container = nodes.length ? $node : $node.parent();
    const text = clean(container.text());
    if (!/20\d{2}|チケット|公演|ライブ|tour/i.test(text)) return null;
    const title = clean(container.find('h1,h2,h3,h4').first().text()) || clean($node.text());
    const link = container.find('a[href]').first().attr('href') || '';
    return makeEvent(source, title, text, link, index);
  }).filter(Boolean);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const source = sourceFor(req.query.artist);
  if (!source) return res.status(200).json({ artist: clean(req.query.artist), count: 0, events: [], supported: false });

  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LiveCue/3.0; +https://github.com/kentundra-a11y/livecue-vercel)',
        'Accept-Language': 'ja,en;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`公式サイト HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    let events = source.kind === 'quruli' ? parseQuruli($, source) : parseGeneric($, source);
    if (!events.length) events = parseGeneric($, source);
    events = events.filter((event, index, array) => array.findIndex(item => item.title === event.title && item.liveDate === event.liveDate) === index).slice(0, 20);
    return res.status(200).json({ artist: source.artist, count: events.length, events, supported: true, officialUrl: source.url, checkedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(200).json({
      artist: source.artist,
      count: 0,
      events: [],
      supported: true,
      officialUrl: source.url,
      warning: error.message,
      checkedAt: new Date().toISOString()
    });
  }
}

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
    newsUrl: 'https://bialystocks.com/news/newstype/live/',
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

function isoDate(year, month, day, hour, minute) {
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return hour == null ? date : `${date}T${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}:00+09:00`;
}

function isSaleContext(text) {
  return /FC先行|オフィシャル.{0,12}先行|一般チケット予約|一般発売|当日券販売|チケット.{0,35}(?:先行|受付|発売|販売|予約)|(?:先行|受付開始|発売開始|販売開始|予約開始).{0,35}チケット/.test(text);
}

function saleInfoFrom(text) {
  const matches = [];
  const regex = /(?:(20\d{2})年)?(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?(?:\s*(\d{1,2}):(\d{2}))?/g;
  let match;
  let rememberedYear = Number(text.match(/(20\d{2})[.\-/年]/)?.[1] || new Date().getFullYear());
  while ((match = regex.exec(text))) {
    if (match[1]) rememberedYear = Number(match[1]);
    const nearby = text.slice(Math.max(0, match.index - 70), Math.min(text.length, regex.lastIndex + 70));
    if (!isSaleContext(nearby)) continue;
    matches.push({
      value: isoDate(rememberedYear, Number(match[2]), Number(match[3]), match[4] == null ? null : Number(match[4]), Number(match[5] || 0)),
      nearby
    });
  }
  if (!matches.length) return { saleDate: '', saleEndDate: '' };
  const endIndex = matches.findIndex((item, index) => index > 0 && /締切|終了|まで|〜|～/.test(item.nearby));
  return {
    saleDate: matches[0].value,
    saleEndDate: endIndex > 0 ? matches[endIndex].value : (matches[1]?.value || '')
  };
}

function statusFrom(saleDate, saleEndDate, text) {
  const now = Date.now();
  const start = saleDate ? Date.parse(saleDate) : NaN;
  const end = saleEndDate ? Date.parse(saleEndDate) : NaN;
  if (!Number.isNaN(start) && start > now) return 'soon';
  if (!Number.isNaN(start) && start <= now && !Number.isNaN(end) && end >= now) return 'open';
  if (!Number.isNaN(start) && start <= now && Number.isNaN(end)) return now - start < 180 * 86400000 ? 'open' : 'ended';
  if (!Number.isNaN(end) && end < now) return 'ended';
  return /受付中|販売中|発売中|一般発売開始/.test(text) ? 'open' : 'waiting';
}

function makeEvent(source, title, body, url, index) {
  const text = clean(body).slice(0, 700);
  const liveDate = dateFrom(`${title} ${text}`);
  const { saleDate, saleEndDate } = saleInfoFrom(text);
  return {
    id: `official-${source.artist}-${liveDate || 'news'}-${index}`,
    artist: source.artist,
    title: (clean(title) || `${source.artist} 公式ライブ情報`).slice(0, 160),
    venue: '',
    city: '',
    liveDate,
    liveTime: '',
    saleLabel: /先行/.test(text) ? '先行販売情報' : /一般/.test(text) ? '一般販売情報' : '公式ライブ情報',
    saleDate,
    saleEndDate,
    status: statusFrom(saleDate, saleEndDate, text),
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

async function parseLinkedNews(source, headers) {
  if (!source.newsUrl) return [];
  try {
    const listingResponse = await fetch(source.newsUrl, { headers });
    if (!listingResponse.ok) return [];
    const $listing = cheerio.load(await listingResponse.text());
    const links = [...new Set($listing('a[href*="/news/"]').map((_, link) => absolute($listing(link).attr('href'), source.newsUrl)).get())]
      .filter(url => /\/news\/\d+\/?$/.test(url))
      .slice(0, 8);
    const pages = await Promise.allSettled(links.map(async (url, index) => {
      const response = await fetch(url, { headers });
      if (!response.ok) return null;
      const $ = cheerio.load(await response.text());
      const body = clean($('main').text() || $('body').text());
      if (!isSaleContext(body)) return null;
      const headings = $('h1,h2,h3').map((_, heading) => clean($(heading).text())).get().filter(text => text && !/^(NEWS|LIVE|Bialystocks)$/i.test(text));
      const title = headings[0] || clean(body.replace(/^20\d{2}\.\d{1,2}\.\d{1,2}\s*/, '').slice(0, 100));
      return makeEvent(source, title, body, url, 100 + index);
    }));
    return pages.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const source = sourceFor(req.query.artist);
  if (!source) return res.status(200).json({ artist: clean(req.query.artist), count: 0, events: [], supported: false });

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; LiveCue/4.0; +https://github.com/kentundra-a11y/livecue-vercel)',
      'Accept-Language': 'ja,en;q=0.8'
    };
    const response = await fetch(source.url, {
      headers
    });
    if (!response.ok) throw new Error(`公式サイト HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    let events = source.kind === 'quruli' ? parseQuruli($, source) : parseGeneric($, source);
    if (!events.length) events = parseGeneric($, source);
    events.push(...await parseLinkedNews(source, headers));
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

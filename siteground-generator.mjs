/**
 * AnimeAI Bluesky feed generator for SiteGround's managed Node.js projects.
 * No database, firehose, credentials or third-party npm dependencies.
 *
 * SiteGround's GitHub deployment pulls the same feed.json that the existing
 * GitHub Actions collector refreshes every six hours.
 *
 * Feed URI verified from the live Bluesky record on 2026-10-21.
 * FEED_URI may override this value; no credentials or env setup are required.
 * SiteGround supplies PORT and terminates HTTPS in front of this Node process.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const SERVICE_DID = 'did:web:animeai.trevorion.io';
const EXISTING_FEED_URI = 'at://did:plc:c36xxd4j5cyfojgcfgwt7fd5/app.bsky.feed.generator/animeai';
const FEED_FILE = new URL('./feed.json', import.meta.url);
const HOMEPAGE_FILE = new URL('./siteground-homepage.html', import.meta.url);
const RESTRICTED_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media']);
const URI_PATTERN = /^at:\/\/did:(?:plc|web):[^/]+\/app\.bsky\.feed\.post\/[A-Za-z0-9._~-]+$/;
const MAX_LIMIT = 100;

let cachedFeed = null;
let cacheUntil = 0;

function json(res, status, body, cacheSeconds = 0) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheSeconds ? 'public, max-age=' + cacheSeconds : 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function validatedThumbnail(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'cdn.bsky.app'
        || !url.pathname.startsWith('/img/feed_thumbnail/plain/')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function postLink(uri) {
  const match = /^at:\/\/(did:(?:plc|web):[^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)$/.exec(uri);
  return match ? 'https://bsky.app/profile/' + match[1] + '/post/' + match[2] : null;
}

function displayDate(timestamp) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(timestamp));
}

async function renderHomepage() {
  const [template, posts] = await Promise.all([
    readFile(HOMEPAGE_FILE, 'utf8'),
    loadFeed(),
  ]);
  // The native Bluesky feed remains unchanged; this filtering applies to the
  // public landing page's illustrative previews only.
  const visible = posts.filter(post => !post.restricted);
  const imagePosts = visible.filter(post => post.thumbnail && postLink(post.uri));

  const heroMosaic = imagePosts.slice(0, 24).map(post =>
    '<img loading="lazy" decoding="async" alt="" src="' + escapeHtml(post.thumbnail) + '">'
  ).join('');

  const art = imagePosts.slice(0, 12).map(post => {
    const url = postLink(post.uri);
    const author = escapeHtml(post.author);
    return '<a href="' + escapeHtml(url) + '" aria-label="View artwork by ' + author
      + ' on Bluesky"><img loading="lazy" decoding="async" alt="" src="'
      + escapeHtml(post.thumbnail) + '"><span class="by">@'
      + author + '</span></a>';
  }).join('') || '<p class="empty">No image posts in the current preview.</p>';

  const latest = visible.filter(post => postLink(post.uri)).slice(0, 6).map(post => {
    const url = postLink(post.uri);
    const text = Array.from(post.text).slice(0, 280).join('');
    return '<a class="post" href="' + escapeHtml(url) + '"><div class="post-head">'
      + '<span class="post-author">@' + escapeHtml(post.author) + '</span>'
      + '<span class="post-date">' + escapeHtml(displayDate(post.timestamp)) + '</span>'
      + '</div><p class="post-text">' + escapeHtml(text)
      + (Array.from(post.text).length > 280 ? '…' : '') + '</p></a>';
  }).join('') || '<p class="empty">No posts in the current preview.</p>';

  const authorCount = new Set(posts.map(post => post.author)).size;
  const stats = '<span><strong>' + posts.length + '</strong> recent posts</span>'
    + '<span><strong>' + authorCount + '</strong> creators</span>'
    + '<span><strong>' + escapeHtml(displayDate(posts[0].timestamp))
    + '</strong> latest indexed post (UTC)</span>';

  return template
    .replaceAll('{{HERO_MOSAIC}}', heroMosaic)
    .replaceAll('{{RECENT_ART}}', art)
    .replaceAll('{{RECENT_POSTS}}', latest)
    .replaceAll('{{FEED_STATS}}', stats)
    .replaceAll('{{YEAR}}', String(new Date().getUTCFullYear()));
}

function parseCursor(raw) {
  if (!raw || raw.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new Error('Invalid cursor');
  }
  const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!obj || !Number.isSafeInteger(obj.t) || typeof obj.u !== 'string' || !URI_PATTERN.test(obj.u)) {
    throw new Error('Invalid cursor');
  }
  return obj;
}

function encodeCursor(entry) {
  return Buffer.from(JSON.stringify({ t: entry.timestamp, u: entry.uri })).toString('base64url');
}

async function loadFeed() {
  if (cachedFeed && Date.now() < cacheUntil) return cachedFeed;

  const raw = JSON.parse(await readFile(FEED_FILE, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('feed.json is not an array');

  const unique = new Map();
  for (const post of raw) {
    if (!post || typeof post.uri !== 'string' || !URI_PATTERN.test(post.uri)) continue;
    const timestamp = Date.parse(post.indexed_at ?? post.record?.created_at ?? '');
    if (!Number.isFinite(timestamp) || !Number.isSafeInteger(timestamp)) continue;
    const previous = unique.get(post.uri);
    if (!previous || timestamp > previous.timestamp) {
      const labels = Array.isArray(post.labels) ? post.labels : [];
      const restricted = labels.some(label => RESTRICTED_LABELS.has(label?.val));
      unique.set(post.uri, {
        uri: post.uri,
        timestamp,
        author: typeof post.author === 'string' ? post.author : 'Bluesky creator',
        text: typeof post.record?.text === 'string' ? post.record.text : '',
        thumbnail: validatedThumbnail(post.embed?.images?.[0]?.thumb),
        restricted,
      });
    }
  }

  const posts = [...unique.values()].sort(
    (a, b) => b.timestamp - a.timestamp || (a.uri < b.uri ? 1 : a.uri > b.uri ? -1 : 0)
  );
  if (!posts.length) throw new Error('feed.json contains no valid post AT URIs');

  // Retain a snapshot only after successful loading; no new external requests.
  cachedFeed = posts;
  cacheUntil = Date.now() + 60_000;
  return posts;
}

function getExpectedFeedUri() {
  const uri = process.env.FEED_URI?.trim() || EXISTING_FEED_URI;
  if (!/^at:\/\/did:(?:plc|web):[^/]+\/app\.bsky\.feed\.generator\/[A-Za-z0-9._~-]+$/.test(uri)) {
    return null;
  }
  return uri;
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  let url;
  try {
    url = new URL(req.url, 'https://animeai.trevorion.io');
  } catch {
    return json(res, 400, { error: 'Malformed URL' });
  }

  if (url.pathname === '/') {
    try {
      const html = await renderHomepage();
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src https://cdn.bsky.app; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      });
      res.end(html);
    } catch (err) {
      console.error('AnimeAI homepage unavailable:', err);
      return json(res, 503, { error: 'Homepage temporarily unavailable' });
    }
    return;
  }

  if (url.pathname === '/health') {
    try {
      const posts = await loadFeed();
      return json(res, 200, {
        status: 'ok',
        source: 'GitHub Actions feed.json',
        posts: posts.length,
        latestIndexedAt: new Date(posts[0].timestamp).toISOString(),
        configured: Boolean(getExpectedFeedUri()),
      });
    } catch (err) {
      console.error('AnimeAI feed health:', err);
      return json(res, 503, { status: 'unavailable', reason: 'feed.json unavailable' });
    }
  }

  const feedUri = getExpectedFeedUri();
  if (!feedUri) return json(res, 503, { error: 'FEED_URI not configured' });

  if (url.pathname === '/xrpc/app.bsky.feed.describeFeedGenerator') {
    return json(res, 200, { did: SERVICE_DID, feeds: [{ uri: feedUri }] }, 60);
  }

  if (url.pathname !== '/xrpc/app.bsky.feed.getFeedSkeleton') {
    return json(res, 404, { error: 'Not found' });
  }

  if (url.searchParams.get('feed') !== feedUri) {
    return json(res, 400, { error: 'Unsupported feed URI' });
  }

  const limitText = url.searchParams.get('limit') ?? '20';
  if (!/^\d{1,3}$/.test(limitText)) {
    return json(res, 400, { error: 'Invalid limit' });
  }
  const limit = Number(limitText);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return json(res, 400, { error: 'Invalid limit' });
  }

  let after = null;
  if (url.searchParams.has('cursor')) {
    try {
      after = parseCursor(url.searchParams.get('cursor'));
    } catch {
      return json(res, 400, { error: 'Malformed cursor' });
    }
  }

  try {
    const posts = await loadFeed();
    const eligible = after
      ? posts.filter(x => x.timestamp < after.t || (x.timestamp === after.t && x.uri < after.u))
      : posts;
    const page = eligible.slice(0, limit);

    const answer = { feed: page.map(({ uri }) => ({ post: uri })) };
    if (page.length && eligible.length > limit) {
      answer.cursor = encodeCursor(page[page.length - 1]);
    }
    return json(res, 200, answer, 30);
  } catch (err) {
    console.error('AnimeAI feed read failure:', err);
    return json(res, 503, { error: 'Feed data temporarily unavailable' });
  }
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be a valid TCP port');
}

http.createServer((req, res) => {
  handler(req, res).catch(err => {
    console.error('Unhandled AnimeAI request error:', err);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
    else res.end();
  });
}).listen(port, '0.0.0.0', () => console.log('AnimeAI feed generator listening'));

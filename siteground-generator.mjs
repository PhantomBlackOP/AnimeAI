/**
 * AnimeAI Bluesky feed generator for SiteGround's managed Node.js projects.
 * No database, firehose, credentials or third-party npm dependencies.
 *
 * SiteGround's GitHub deployment pulls the same feed.json that the existing
 * GitHub Actions collector refreshes every six hours.
 *
 * Required environment variable: FEED_URI (the *existing* Bluesky feed AT URI).
 * SiteGround supplies PORT and terminates HTTPS in front of this Node process.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const SERVICE_DID = 'did:web:animeai.trevorion.io';
const FEED_FILE = new URL('./feed.json', import.meta.url);
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
      unique.set(post.uri, { uri: post.uri, timestamp });
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
  const uri = process.env.FEED_URI?.trim() || '';
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

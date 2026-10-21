// AnimeAI read-only Bluesky feed skeleton, backed by the existing GitHub feed.json.
// Deployed as a Vercel Function; this does NOT modify the existing collection workflow.
const SOURCE_URL = 'https://raw.githubusercontent.com/PhantomBlackOP/AnimeAI/main/feed.json';
const POST_URI = /^at:\/\/did:(?:plc|web):[^/]+\/app\.bsky\.feed\.post\/[a-zA-Z0-9._~-]+$/;

function error(res, code, message) {
  return res.status(code).json({ error: message });
}

function cursorFrom(item) {
  return Buffer.from(JSON.stringify({ t: item.timestamp, u: item.uri }), 'utf8').toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string' || cursor.length > 2048) throw new Error('Invalid cursor');
  const encoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const decoded = JSON.parse(encoded);
  if (!Number.isFinite(decoded.t) || typeof decoded.u !== 'string' || !POST_URI.test(decoded.u)) {
    throw new Error('Invalid cursor');
  }
  return decoded;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed');

  const feedUri = process.env.FEED_URI;
  if (!feedUri) return error(res, 503, 'Generator FEED_URI is not configured');
  if (req.query.feed !== feedUri) return error(res, 400, 'Unsupported feed URI');

  const parsedLimit = Number(req.query.limit ?? 20);
  if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1) {
    return error(res, 400, 'Invalid limit');
  }
  const limit = Math.min(parsedLimit, 100);

  let boundary = null;
  if (req.query.cursor !== undefined) {
    try {
      boundary = decodeCursor(req.query.cursor);
    } catch {
      return error(res, 400, 'Malformed cursor');
    }
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Source returned HTTP ' + response.status);
    const raw = await response.json();
    if (!Array.isArray(raw)) throw new Error('Source is not an array');

    const byUri = new Map();
    for (const candidate of raw) {
      if (!candidate || typeof candidate.uri !== 'string' || !POST_URI.test(candidate.uri)) continue;
      const timestamp = Date.parse(candidate.indexed_at ?? candidate.record?.created_at ?? '');
      if (!Number.isFinite(timestamp)) continue;
      const previous = byUri.get(candidate.uri);
      if (!previous || previous.timestamp < timestamp) {
        byUri.set(candidate.uri, { uri: candidate.uri, timestamp });
      }
    }

    if (byUri.size === 0) throw new Error('No valid Bluesky post URIs in source');

    const entries = Array.from(byUri.values()).sort(
      (a, b) => b.timestamp - a.timestamp || (a.uri < b.uri ? 1 : a.uri > b.uri ? -1 : 0)
    );
    const eligible = boundary
      ? entries.filter(item => item.timestamp < boundary.t ||
          (item.timestamp === boundary.t && item.uri < boundary.u))
      : entries;
    const page = eligible.slice(0, limit);
    const body = { feed: page.map(item => ({ post: item.uri })) };
    if (eligible.length > limit && page.length) {
      body.cursor = cursorFrom(page[page.length - 1]);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(body);
  } catch (err) {
    console.error('AnimeAI skeleton upstream unavailable:', err.message);
    return error(res, 503, 'AnimeAI source temporarily unavailable');
  }
}

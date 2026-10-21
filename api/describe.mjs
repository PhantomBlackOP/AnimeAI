// AT Protocol feed generator metadata. FEED_URI and FEEDGEN_DID are set on the host.
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const did = process.env.FEEDGEN_DID;
  const feedUri = process.env.FEED_URI;
  if (!did || !did.startsWith('did:web:') || !feedUri?.startsWith('at://')) {
    return res.status(503).json({ error: 'Feed generator identity not configured' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300');
  return res.status(200).json({ did, feeds: [{ uri: feedUri }] });
}

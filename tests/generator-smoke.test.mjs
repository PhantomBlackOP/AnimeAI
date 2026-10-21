import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FEED_URI = 'at://did:plc:c36xxd4j5cyfojgcfgwt7fd5/app.bsky.feed.generator/animeai';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}

test('SiteGround adapter serves current GitHub feed.json through ATProto XRPC', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, ['siteground-generator.mjs'], {
    env: { ...process.env, PORT: String(port), FEED_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  const root = 'http://127.0.0.1:' + port;

  async function request(path) {
    const response = await fetch(root + path);
    return { status: response.status, data: await response.json() };
  }

  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error('Generator exited: ' + stderr);
      try {
        const health = await request('/health');
        assert.equal(health.status, 200);
        assert.equal(health.data.status, 'ok');
        assert.ok(health.data.posts > 0);
        assert.equal(health.data.configured, true);
        ready = true;
        break;
      } catch {
        await sleep(100);
      }
    }
    assert.ok(ready, 'Server did not become healthy: ' + stderr);

    const homepageResponse = await fetch(root + '/');
    assert.equal(homepageResponse.status, 200);
    assert.match(homepageResponse.headers.get('content-type'), /text\/html/);
    assert.match(homepageResponse.headers.get('content-security-policy'), /default-src/);
    const homepage = await homepageResponse.text();
    assert.match(homepage, /<h1>ANIMEAI<\/h1>/);
    assert.match(homepage, /Where anime meets AI/);
    assert.match(homepage, /Recent artwork/);
    assert.match(homepage, /Latest posts/);
    assert.match(homepage, /bsky\.app\/profile\/trevorion\.io\/feed\/animeai/);
    assert.match(homepage, /cdn\.bsky\.app\/img\/feed_thumbnail/);
    assert.doesNotMatch(homepage, /\{\{(?:HERO_MOSAIC|FEED_STATS|RECENT_ART|RECENT_POSTS|YEAR)\}\}/);

    const description = await request('/xrpc/app.bsky.feed.describeFeedGenerator');
    assert.equal(description.status, 200);
    assert.equal(description.data.did, 'did:web:animeai.trevorion.io');
    assert.deepEqual(description.data.feeds, [{ uri: FEED_URI }]);

    const feedPath = '/xrpc/app.bsky.feed.getFeedSkeleton?feed=' + encodeURIComponent(FEED_URI);
    const page1 = await request(feedPath + '&limit=2');
    assert.equal(page1.status, 200);
    assert.equal(page1.data.feed.length, 2);
    assert.ok(page1.data.feed.every(p => p.post.startsWith('at://did:')));
    assert.ok(page1.data.cursor);

    const page2 = await request(feedPath + '&limit=2&cursor=' + encodeURIComponent(page1.data.cursor));
    assert.equal(page2.status, 200);
    assert.equal(page2.data.feed.length, 2);
    assert.ok(page2.data.feed.every(p => !page1.data.feed.some(q => q.post === p.post)));

    assert.equal((await request(feedPath + '&limit=0')).status, 400);
    assert.equal((await request(feedPath + '&cursor=garbage')).status, 400);
    assert.equal((await request('/xrpc/app.bsky.feed.getFeedSkeleton?feed=invalid')).status, 400);
    assert.equal((await request('/missing')).status, 404);
  } finally {
    child.kill('SIGTERM');
  }
});


test('Latest-post cards include image thumbnails only when available', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'animeai-card-test-'));
  const port = await freePort();
  const author = 'did:plc:abcdefghijklmnopqrstuvwx';
  const base = 'at://' + author + '/app.bsky.feed.post/';
  const imageUrl = 'https://cdn.bsky.app/img/feed_thumbnail/plain/' + author + '/bafkreifakefixture';
  const fixture = [
    {
      uri: base + '3aaaaaaa', author: 'image-artist.bsky.social',
      indexed_at: '2026-10-22T10:00:00.000Z',
      record: { text: 'Fresh art with <special> details' },
      labels: [],
      embed: { images: [{ thumb: imageUrl }] },
    },
    {
      uri: base + '3bbbbbbb', author: 'text-only.bsky.social',
      indexed_at: '2026-10-21T10:00:00.000Z',
      record: { text: 'A plain text update' },
      labels: [],
      embed: null,
    },
    {
      uri: base + '3ccccccc', author: 'restricted.bsky.social',
      indexed_at: '2026-10-20T10:00:00.000Z',
      record: { text: 'Restricted preview' },
      labels: [{ val: 'porn' }],
      embed: { images: [{ thumb: imageUrl }] },
    },
  ];
  let child;
  try {
    await copyFile('siteground-generator.mjs', join(dir, 'siteground-generator.mjs'));
    await copyFile('siteground-homepage.html', join(dir, 'siteground-homepage.html'));
    await writeFile(join(dir, 'feed.json'), JSON.stringify(fixture));

    child = spawn(process.execPath, [join(dir, 'siteground-generator.mjs')], {
      env: { ...process.env, PORT: String(port), FEED_URI: '' },
      stdio: 'ignore',
    });

    const root = 'http://127.0.0.1:' + port;
    let response;
    for (let i = 0; i < 50; i++) {
      try {
        response = await fetch(root + '/');
        break;
      } catch {
        await sleep(100);
      }
    }
    assert.ok(response, 'Fixture server must start');
    assert.equal(response.status, 200);
    const page = await response.text();
    const recent = page.split('<div class="posts">')[1].split('</section>')[0];

    assert.match(recent, /<a class="post post-with-image"[^>]*><img class="post-thumbnail"/);
    assert.match(recent, /src="https:\/\/cdn\.bsky\.app\/img\/feed_thumbnail\/plain\//);
    assert.match(recent, /<a class="post"[^>]*><div class="post-copy">/);
    assert.equal((recent.match(/class="post-thumbnail"/g) || []).length, 1);
    assert.match(recent, /Fresh art with &lt;special&gt; details/);
    assert.match(recent, /A plain text update/);
    assert.doesNotMatch(recent, /Restricted preview/);

    const skeleton = await fetch(root + '/xrpc/app.bsky.feed.getFeedSkeleton?feed=' +
      encodeURIComponent(FEED_URI));
    assert.equal(skeleton.status, 200);
    assert.equal((await skeleton.json()).feed.length, 3,
      'Homepage preview restrictions must not change the native Bluesky feed');
  } finally {
    if (child) child.kill('SIGTERM');
    await rm(dir, { recursive: true, force: true });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

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

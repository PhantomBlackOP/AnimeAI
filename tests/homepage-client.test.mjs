import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.attributes = {};
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
}

test('Shared index.html previews image and text posts without changing the Bluesky source', async () => {
  const nodes = new Map([
    ['#hero-mosaic', new FakeElement('div')],
    ['#art-gallery', new FakeElement('div')],
    ['#latest-posts', new FakeElement('div')],
    ['#feed-stats', new FakeElement('div')],
    ['#copyright-year', new FakeElement('span')],
  ]);

  let onReady;
  const document = {
    readyState: 'loading',
    querySelector(selector) { return nodes.get(selector) ?? null; },
    createElement(tag) { return new FakeElement(tag); },
    createTextNode(text) { return { tagName: '#text', textContent: text }; },
    addEventListener(name, callback) {
      if (name === 'DOMContentLoaded') onReady = callback;
    },
  };

  const author = 'did:plc:abcdefghijklmnopqrstuvwx';
  const uriBase = 'at://' + author + '/app.bsky.feed.post/';
  const imageUrl = 'https://cdn.bsky.app/img/feed_thumbnail/plain/' + author + '/bafkreifakefixture';
  const fixture = [
    {
      uri: uriBase + '3aaaaaaa',
      author: 'image-artist.bsky.social',
      indexed_at: '2026-10-22T10:00:00.000Z',
      record: { text: 'Fresh artwork with <script> as literal text' },
      labels: [],
      embed: { images: [{ thumb: imageUrl }] },
    },
    {
      uri: uriBase + '3bbbbbbb',
      author: 'text-only.bsky.social',
      indexed_at: '2026-10-21T10:00:00.000Z',
      record: { text: 'A plain text update' },
      labels: [],
      embed: null,
    },
    {
      uri: uriBase + '3ccccccc',
      author: 'restricted.bsky.social',
      indexed_at: '2026-10-20T10:00:00.000Z',
      record: { text: 'Restricted preview' },
      labels: [{ val: 'porn' }],
      embed: { images: [{ thumb: imageUrl }] },
    },
  ];

  const requests = [];
  const fetch = async (path) => {
    requests.push(path);
    return { ok: true, json: async () => fixture };
  };

  const script = await readFile('animeai-home.js', 'utf8');
  vm.runInNewContext(script, { document, fetch, URL, Date, Intl, console });
  assert.equal(typeof onReady, 'function');
  await onReady();

  assert.deepEqual(requests, ['/feed.json']);

  const latest = nodes.get('#latest-posts').children;
  assert.equal(latest.length, 2, 'Adult-labeled posts are omitted from homepage previews');
  assert.equal(latest[0].className, 'post post-with-image');
  assert.equal(latest[0].children[0].tagName, 'img');
  assert.equal(latest[0].children[0].src, imageUrl);
  assert.equal(latest[0].href, 'https://bsky.app/profile/' + author + '/post/3aaaaaaa');
  assert.equal(latest[1].className, 'post');
  assert.equal(latest[1].children[0].className, 'post-copy');
  assert.equal(latest[0].children[1].children[1].textContent,
    'Fresh artwork with <script> as literal text');

  assert.equal(nodes.get('#art-gallery').children.length, 1);
  assert.equal(nodes.get('#hero-mosaic').children.length, 1);
  const stats = nodes.get('#feed-stats').children;
  assert.equal(stats.length, 3);
  assert.equal(stats[0].children[0].textContent, '3');
  assert.equal(stats[1].children[0].textContent, '3');
  assert.equal(nodes.get('#copyright-year').textContent, String(new Date().getUTCFullYear()));
});

test('Shared homepage preserves correct paths and contains no obsolete redirect', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /<script src="\/animeai-home\.js" defer><\/script>/);
  for (const id of ['hero-mosaic', 'feed-stats', 'art-gallery', 'latest-posts']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /<h1>ANIMEAI<\/h1>/);
  assert.doesNotMatch(html, /http-equiv="refresh"/);
  assert.match(html, /<a class="portal" href="#latest">[^\n]*<strong>Latest posts<\/strong>/);
  assert.match(html, /<a href="https:\/\/animeai\.trevorion\.io\/feed\.json">Feed JSON<\/a>/);
  assert.match(html, /<a class="portal" href="https:\/\/zine\.trevorion\.io\/"/);
  assert.match(html, /<a href="https:\/\/zine\.trevorion\.io\/">Trevorion Zine<\/a>/);
  assert.doesNotMatch(html, /href="https:\/\/github\.com\//i);
  assert.doesNotMatch(html, /Zine News|Zine archive|Zine articles|Open-source project|See the code/i);
  assert.doesNotMatch(html, /href="https:\/\/zine\.trevorion\.io\/(?:news|archive|articles)\//i);
  assert.doesNotMatch(html, /window\.location\.replace/);
  assert.doesNotMatch(html, /\{\{(?:RECENT_ART|RECENT_POSTS|FEED_STATS|HERO_MOSAIC|YEAR)\}\}/);
});

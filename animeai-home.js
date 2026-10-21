'use strict';

(() => {
  const FEED_URL = '/feed.json';
  const RESTRICTED_LABELS = new Set(['porn', 'sexual', 'nudity', 'graphic-media']);
  const POST_URI = /^at:\/\/(did:(?:plc|web):[^/]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9._~-]+)$/;

  function validThumbnail(value) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'cdn.bsky.app'
        && url.pathname.startsWith('/img/feed_thumbnail/plain/')
        ? url.href : null;
    } catch {
      return null;
    }
  }

  function postLink(uri) {
    const match = typeof uri === 'string' ? POST_URI.exec(uri) : null;
    return match ? 'https://bsky.app/profile/' + match[1] + '/post/' + match[2] : null;
  }

  function formatDate(timestamp) {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(timestamp));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function image(src, className = '') {
    const img = element('img', className);
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    return img;
  }

  function replaceChildren(selector, children) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.replaceChildren(...children);
  }

  function normalizePosts(raw) {
    if (!Array.isArray(raw)) throw new Error('Invalid AnimeAI feed data');
    const byUri = new Map();
    for (const post of raw) {
      const link = postLink(post?.uri);
      const timestamp = Date.parse(post?.indexed_at ?? post?.record?.created_at ?? '');
      if (!link || !Number.isFinite(timestamp)) continue;

      const existing = byUri.get(post.uri);
      if (existing && existing.timestamp >= timestamp) continue;

      byUri.set(post.uri, {
        uri: post.uri,
        link,
        timestamp,
        author: typeof post.author === 'string' ? post.author : 'Bluesky creator',
        text: typeof post.record?.text === 'string' ? post.record.text : '',
        thumbnail: validThumbnail(post.embed?.images?.[0]?.thumb),
        restricted: Array.isArray(post.labels)
          && post.labels.some(label => RESTRICTED_LABELS.has(label?.val)),
      });
    }
    return [...byUri.values()].sort((a, b) =>
      b.timestamp - a.timestamp || (a.uri < b.uri ? 1 : a.uri > b.uri ? -1 : 0)
    );
  }

  function renderHero(posts) {
    const images = posts.filter(post => post.thumbnail);
    replaceChildren('#hero-mosaic', images.slice(0, 24).map(post => image(post.thumbnail)));
    return images;
  }

  function renderGallery(images) {
    const nodes = images.slice(0, 12).map(post => {
      const link = element('a');
      link.href = post.link;
      link.setAttribute('aria-label', 'View artwork by ' + post.author + ' on Bluesky');
      link.append(image(post.thumbnail), element('span', 'by', '@' + post.author));
      return link;
    });
    replaceChildren('#art-gallery', nodes.length
      ? nodes : [element('p', 'empty', 'No image posts in the current preview.')]);
  }

  function renderPosts(posts) {
    const nodes = posts.slice(0, 6).map(post => {
      const link = element('a', post.thumbnail ? 'post post-with-image' : 'post');
      link.href = post.link;

      if (post.thumbnail) link.append(image(post.thumbnail, 'post-thumbnail'));

      const copy = element('div', 'post-copy');
      const header = element('div', 'post-head');
      header.append(
        element('span', 'post-author', '@' + post.author),
        element('span', 'post-date', formatDate(post.timestamp))
      );

      const characters = Array.from(post.text);
      const excerpt = characters.slice(0, 280).join('') + (characters.length > 280 ? '…' : '');
      copy.append(header, element('p', 'post-text', excerpt));
      link.append(copy);
      return link;
    });
    replaceChildren('#latest-posts', nodes.length
      ? nodes : [element('p', 'empty', 'No posts in the current preview.')]);
  }

  function renderStats(posts) {
    if (!posts.length) return;
    const authors = new Set(posts.map(post => post.author)).size;
    const stats = [
      [posts.length, 'recent posts'],
      [authors, 'creators'],
      [formatDate(posts[0].timestamp), 'latest indexed post (UTC)'],
    ];
    replaceChildren('#feed-stats', stats.map(([value, label]) => {
      const span = element('span');
      span.append(element('strong', '', value), document.createTextNode(' ' + label));
      return span;
    }));
  }

  async function load() {
    const year = document.querySelector('#copyright-year');
    if (year) year.textContent = String(new Date().getUTCFullYear());

    try {
      const response = await fetch(FEED_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Feed HTTP ' + response.status);

      const posts = normalizePosts(await response.json());
      if (!posts.length) throw new Error('No valid Bluesky posts');

      const visible = posts.filter(post => !post.restricted);
      const images = renderHero(visible);
      renderGallery(images);
      renderPosts(visible);
      renderStats(posts);
    } catch (error) {
      console.error('AnimeAI homepage feed unavailable:', error);
      const message = element('p', 'empty', 'Recent posts are temporarily unavailable. Open the full stream on Bluesky.');
      replaceChildren('#latest-posts', [message]);
      replaceChildren('#art-gallery', [element('p', 'empty', 'Artwork preview temporarily unavailable.')]);
      replaceChildren('#feed-stats', [element('span', '', 'Feed status temporarily unavailable')]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load, { once: true });
  } else {
    load();
  }
})();

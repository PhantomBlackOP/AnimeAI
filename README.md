# AnimeAI

A Bluesky custom feed for AI art, anime, and related creator communities, curated by [Trevorion](https://bsky.app/profile/trevorion.io).

## Open the feed

- [AnimeAI on Bluesky](https://bsky.app/profile/trevorion.io/feed/animeai): browse and interact with posts.
- [Website](https://animeai.trevorion.io/): recent artwork and post previews.
- [Collected feed JSON](https://animeai.trevorion.io/feed.json): the public collector snapshot, not an AT Protocol feed skeleton response.
- [Service health](https://bsky.trevorion.io/health).

## How it works

GitHub Actions searches Bluesky for configured hashtags, fetches recent posts from discovered authors, filters and deduplicates them, and refreshes `feed.json` every six hours. A separate daily workflow refreshes `handles.json`.

The website renders previews from that snapshot. A dependency-free Node.js service on SiteGround serves the same website and provides the native Bluesky feed generator. GitHub Pages hosts the public website and service DID document.

Search hashtags are defined in `server/algos/animeai.py`:

`#ai`, `#aiart`, `#aianime`, `#aicommunity`, `#ainews`, `#animenews`, `#animecommunity`, `#chatgpt`, `#copilot`, `#generativeai`, `#grok`.

Discovery tags identify authors; the collector can include their other recent posts. This is an automated feed, not a guarantee that every post contains a matching hashtag.

## Run and test the Node service

Use a Node.js version satisfying `package.json` (20 or newer). No npm dependencies or Bluesky credentials are needed to serve an existing snapshot.

```sh
npm test
npm start
```

The service reads the repository's `feed.json`. Hosting supplies `PORT`; optional `FEED_URI` overrides the configured feed identity. See [deployment and maintenance](docs/GENERATOR-RECOVERY.md).

## Collector and maintenance

Python dependencies are in `requirements.txt`. Scheduled workflows supply `BSKY_APP_USERNAME` and `BSKY_APP_PASSWORD` through GitHub secrets. Python scripts do not automatically load a local `.env`; export the variables before running them locally.

```sh
python -m scripts.generate_feed
python -m scripts.discover_handles
```

The collector imports modules from the retained `server/` package. The old Flask/firehose service is not the production generator. Do not remove that package without checking the collector's full import chain.

Use the manual `repair_feed_registration.yml` workflow for the existing Bluesky registration. Its default is validation only. Do not use the legacy root `publish_feed.py` to maintain the live registration: it can replace display metadata.

Rejected-post diagnostics are local and ignored. Never commit passwords, tokens, `.env`, or private diagnostic payloads.

## Licence and attribution

Project code is under the [MIT licence](LICENSE). Retained upstream Python code carries [Ilya Siamionau's MIT notice](BS%20LICENSE); see [upstream notes](BS%20README.md). Preserve the applicable notices when redistributing code.

Bluesky posts, artwork, and other third-party content retain their respective owners' rights; the software licence does not grant rights to that content.

Maintained by Trevor Grech / PhantomBlackOP ([@Trevorion](https://bsky.app/profile/trevorion.io)). [Website](https://www.trevorion.io/) · [Zine](https://zine.trevorion.io/)

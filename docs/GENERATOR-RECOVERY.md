# AnimeAI deployment and maintenance

Updated 23 October 2026. Trevorion confirmed the feed works after the repository cleanup.

## Production architecture

| Component | Source | Purpose |
| --- | --- | --- |
| Collector | `scripts/generate_feed.py` | Collects, filters and deduplicates Bluesky posts into `feed.json` |
| Handle discovery | `scripts/discover_handles.py` | Refreshes `handles.json` |
| Website | `index.html`, `animeai-home.js` | Shared artwork and latest-post previews |
| Native generator | `siteground-generator.mjs` | Serves the snapshot through AT Protocol XRPC |
| Service identity | `.well-known/did.json` | Links the service DID to the generator endpoint |

GitHub Pages serves `https://animeai.trevorion.io/`. SiteGround deploys branch `main` and serves the same HTML, JavaScript and feed snapshot at `https://bsky.trevorion.io/`.

The Node service needs no database, Bluesky credentials or third-party npm dependencies. Hosting supplies `PORT`. The optional `FEED_URI` setting overrides the default identity; leave it unset for the existing deployment.

The old Python/Flask service is not deployed. Keep its modules for now: the collectors import `server.discovery` and `server.algos.animeai`, including their package initialization dependencies.

## Preserve the registered identity

- User-facing feed: `https://bsky.app/profile/trevorion.io/feed/animeai`
- Feed URI: `at://did:plc:c36xxd4j5cyfojgcfgwt7fd5/app.bsky.feed.generator/animeai`
- Service DID: `did:web:animeai.trevorion.io`
- DID document: `https://animeai.trevorion.io/.well-known/did.json`
- Generator endpoint: `https://bsky.trevorion.io`

The account DID and service DID have different roles. Do not replace the service DID with the account DID or recreate the registered feed.

For registration maintenance, run `repair_feed_registration.yml` in its default validation-only mode first. Apply a change only when intended, after validation passes. The repair script preserves display metadata and uses the current record CID for compare-and-swap. The legacy root `publish_feed.py` can replace metadata and is not the supported maintenance path.

## Scheduled collection

- `update_feed.yml`: every six hours, `0 */6 * * *` (UTC).
- `discover_handles.yml`: daily, `0 3 * * *` (UTC).
- Both support manual dispatch. GitHub scheduled jobs can start later than their nominal time.
- Credentials are supplied through GitHub secrets. Never put actual credentials into repository files.
- Only `feed.json` is committed by the feed collector. `rejected_debug.json` is a local ignored diagnostic file; old public commits still contain earlier copies.
- The push steps retain the existing `GH_PAT` credential and pass it through a step environment variable.

SiteGround's GitHub deployment should refresh its copy of the snapshot after a commit. The Node process caches normalized feed data for 60 seconds.

## Checks

Run `npm test` for generator and homepage tests, and `python -m compileall -q scripts server common` for Python syntax checks. Serving a local snapshot requires no external account login.

Public checks:

- `GET /health` on the generator should return HTTP 200 JSON with `status: ok` and a positive post count.
- `GET /xrpc/app.bsky.feed.describeFeedGenerator` should contain the service DID and exact feed URI above.
- `GET /xrpc/app.bsky.feed.getFeedSkeleton?feed=<URL-encoded-feed-URI>&limit=2` should return valid post AT URIs.
- Verify the DID document's service endpoint and try the feed in Bluesky itself.
- Compare both public homepages and JavaScript if a deployment appears stale.

Repository workflows provide these checks: `test_generator.yml`, `probe_siteground.yml`, `verify_generator_did.yml`, `verify_bsky_appview.yml`, and `verify_site_unification.yml`. `inspect_feed_identity.yml` reads the existing record without changing it.

During hosting deployment or security checks, automated clients may receive HTML challenges or HTTP 202/403. These responses do not verify generator health; repeat a read-only check from an allowed client. On 23 October the local review environment received 403 at the health endpoint, while the homepage returned 200 and Trevorion subsequently confirmed working operation.

## Website behaviour

Both domains use the same source files. The preview shows artwork and six latest-post cards with image or text fallback. Labels `porn`, `sexual`, `nudity`, and `graphic-media` exclude posts from homepage previews only; they do not change the native feed skeleton.

Post text uses `textContent`; thumbnails are restricted to validated Bluesky CDN URLs. The Node-served homepage sets a Content Security Policy. GitHub Pages response headers are controlled by its hosting platform.

Navigation preserves Recent artwork, Latest posts, and the Trevorion Zine homepage. Zine, Feeder, Sitemap and RSS are independent projects.

## Recovery evidence and cleanup

The October 2026 repair retained the original feed URI and restored the native service:

- [Original record repair](https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686550248).
- [Bluesky AppView verification](https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686703284).
- [Shared website verification](https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39694285227).

[Cleanup commit](https://github.com/PhantomBlackOP/AnimeAI/commit/7abb207e75e900e266380aefcdfac34b6377e9d1) removed the obsolete createRecord publisher and its manual workflow, the unreferenced storage helper, and the tracked rejected-post dump. It preserved the active feed selection, schedules, homepage, generator and identity. Three Node tests and Python compilation passed. Common credential patterns were not found in the 54 current files reviewed; this was not an exhaustive historical-secret or dependency-vulnerability audit.

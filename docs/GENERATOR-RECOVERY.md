# AnimeAI native Bluesky feed: SiteGround recovery

Status as of 2026-10-22 (Malta time): **REPAIRED, VERIFIED END TO END, LIVE ON PERMANENT DOMAIN.**

## Architecture (Bluesky-only)

- The original GitHub Actions collector runs every six hours and commits `feed.json` to `PhantomBlackOP/AnimeAI`, branch `main`.
- The SiteGround managed Node.js project deploys that GitHub branch. The dependency-free `siteground-generator.mjs` serves the local static `feed.json` through native AT Protocol endpoints:
  - `https://bsky.trevorion.io/health`
  - `https://bsky.trevorion.io/xrpc/app.bsky.feed.describeFeedGenerator`
  - `https://bsky.trevorion.io/xrpc/app.bsky.feed.getFeedSkeleton`
- The original GitHub Pages website remains at `https://animeai.trevorion.io/`; its DID document is `https://animeai.trevorion.io/.well-known/did.json` and points the feed-generator service DID `did:web:animeai.trevorion.io` to the SiteGround HTTPS endpoint.
- Existing owner account DID is `did:plc:c36xxd4j5cyfojgcfgwt7fd5`. It is **not** itself the service DID.
- **Original preserved feed URI:** `at://did:plc:c36xxd4j5cyfojgcfgwt7fd5/app.bsky.feed.generator/animeai`.
- No Vercel account, running local Python server, database, or SiteGround credentials/environment variables are required for serving the feed.
- The unrelated projects Zine, Feeder, Sitemap, and RSS remain detached.

## Verification evidence (21 October 2026 UTC; 22 October in Malta)

1. **Node SiteGround deployment** verified from public GitHub Actions runner:
   https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686134133
   - `/health`: HTTP 200, 216 valid post URIs in the deployed snapshot.
   - `/xrpc/app.bsky.feed.describeFeedGenerator`: HTTP 200, exact original feed URI and service DID.
   - `/xrpc/app.bsky.feed.getFeedSkeleton`: HTTP 200, Bluesky post URIs and cursor.
2. **DID document** published in `.well-known/did.json` (root `.nojekyll` ensures static hosting). Public DID and service verified:
   https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686309888
   - First attempt coincided with SiteGround redeploy and transient HTTP 202; second attempt succeeded.
3. **Existing Bluesky record repaired** by guarded GitHub Actions:
   https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686550248
   - Script `scripts/repair_feed_registration.py` read the original record, dry-run validated the DID and nonempty skeleton, then updated the original record via `com.atproto.repo.putRecord` with CID compare-and-swap.
   - Record kept same URI, rkey and all existing display metadata; only `did` changed from account DID to `did:web:animeai.trevorion.io`.
   - The one-time automatic activation was **removed** afterwards; `.github/workflows/repair_feed_registration.yml` is manual-only again.
4. **Independent Bluesky AppView verification passed**:
   https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686703284
   - Public `com.atproto.repo.getRecord` returned the original feed URI with correct service DID.
   - Public `app.bsky.feed.getFeed` returned **three real posts** (requested limit 3) successfully.
   - This confirms the feed works through Bluesky, not just directly against SiteGround.

## Maintenance

- Existing collection: `.github/workflows/update_feed.yml`, every six hours.
- SiteGround GitHub auto-deploy should refresh the deployed `feed.json` from every committed update. During redeployment SiteGround may briefly return HTTP 202; later requests should succeed.
- Generator code: `siteground-generator.mjs`; automated unit/smoke tests: `npm test` and `.github/workflows/test_generator.yml`.
- Monitoring:
  - `https://bsky.trevorion.io/health`
  - `https://animeai.trevorion.io/.well-known/did.json`
  - `https://github.com/PhantomBlackOP/AnimeAI/actions`
- **Permanent hostname:** `bsky.trevorion.io` points to SiteGround Site IP `34.1.230.193` using a Squarespace DNS A record. The original temporary SiteGround hostname has been retired from the public service DID.
- The old `server/` Python/Flask files and original broken `scripts/publish_feed.py` are not part of the live Node generator. Do **not** run the old publish script as it uses `createRecord` and the account DID incorrectly.
- For any future record change, use the manual-only `repair_feed_registration.yml` workflow with validation and explicit approval.

## User-facing Bluesky feed

`https://bsky.app/profile/trevorion.io/feed/animeai`

This links to the **existing** registered AnimeAI Stream, not a replacement.

## Permanent-domain activation, 2026-10-22 (Malta time)

- SiteGround project primary domain set to `bsky.trevorion.io` by Trevorion; Squarespace `A bsky -> 34.1.230.193`. Existing domain nameservers remained at Squarespace.
- Initial independent probe failed with a self-signed certificate; subsequent re-run confirmed valid HTTPS and all generator endpoints, **216 posts**, on the permanent hostname: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39689458037 (attempt 2).
- Updated GitHub Pages `.well-known/did.json` to point to `https://bsky.trevorion.io`. Published DID document and generator tests both passed: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39690232246.
- Verified original Bluesky AppView endpoint still returns 3 real posts after the DID switch: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39686703284 (attempt 3).
- The Node.js root URL `https://bsky.trevorion.io/` now serves an HTML landing page inspired by the RSS homepage. `/health` remains the machine-readable status endpoint.
- During transient SiteGround redeploy/security checks, the temporary domain returned HTTP 202 with a SiteGround CAPTCHA to certain automated clients; do **not** interpret HTTP 202 HTML as a valid Bluesky API response. Permanent domain was tested separately.

## RSS-inspired AnimeAI homepage, 2026-10-22 (Malta time)

- `https://bsky.trevorion.io/` serves HTTP 200 HTML, no longer the original JSON 404. The Node generator handles only `GET /` for this page. API routes and output remain unchanged.
- Design follows `PhantomBlackOP/RSS`'s dark navy palette, mosaic hero, featured feed card, navigation cards and recent artwork/posts, but displays Bluesky content, not Zine posts.
- `siteground-homepage.html` is the standalone HTML/CSS template. `siteground-generator.mjs` fills it from the same cached local `feed.json` data used by the live generator.
- The homepage includes current post and creator counts, latest indexed date (UTC), Bluesky feed subscription link, links to raw JSON and GitHub, a twelve-thumbnail artwork preview and six recent post excerpts.
- Bluesky thumbnails come from public `cdn.bsky.app` URLs. The page excludes posts labeled `porn`, `sexual`, `nudity`, or `graphic-media` from previews without altering the native feed's selection; all user text is HTML-escaped. A restrictive Content Security Policy blocks scripts and limits image sources.
- Tests in `tests/generator-smoke.test.mjs` cover HTTP 200 HTML homepage plus native Bluesky endpoints; GitHub Actions PASS: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39690979403
- **Independent external verification** of the live public HTTPS homepage and unchanged generator API: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39691042861 (HTTP 200, HTML page containing AnimeAI header, artwork and latest posts; returned 24,415 bytes).

## Latest Posts thumbnail update, 2026-10-22 (Malta)

- The Latest Posts section now displays a compact Bluesky image preview on each card whenever the post has a valid CDN thumbnail. Image-less posts remain text-only.
- Implemented in `siteground-generator.mjs` with responsive card styles in `siteground-homepage.html`. Existing content-label filtering for homepage previews and HTML escaping are preserved.
- Added a fixture-based test covering one thumbnail post, one text-only post and one adult-labeled post. Native feed skeleton content remains unchanged.
- CI passed: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39691891275
- Live SiteGround homepage verified to include both image and text-only post cards, while health and XRPC endpoints remain operational: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39691960949

## Legacy AnimeAI website unification, 2026-10-22

- Before this change, `https://animeai.trevorion.io/` showed an obsolete static 2025 introduction, including an incorrect implication that raw JSON can be subscribed to directly as a Bluesky custom feed.
- The root `index.html` of the **existing GitHub Pages site** now sends visitors to the current SiteGround homepage `https://bsky.trevorion.io/` via a zero-delay meta refresh and JavaScript redirect, with an accessible manual link as fallback.
- The redirect applies **only to the root homepage**. `https://animeai.trevorion.io/feed.json` and `https://animeai.trevorion.io/.well-known/did.json` remain served directly by GitHub Pages. The DID identity and generator service endpoint remain unchanged.
- The SiteGround homepage's footer no longer links back redundantly to the obsolete AnimeAI website; it now links directly to the public Feed JSON. Its Bluesky feed link remains `https://bsky.app/profile/trevorion.io/feed/animeai`.
- The websites share the same underlying AnimeAI post inventory but differ in display: SiteGround previews posts and art, while Bluesky supplies the full native interactive feed.
- Generator CI after footer change passed: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39692299073
- Independent live verification is performed by `.github/workflows/verify_site_unification.yml`; inspect the latest workflow result before claiming the public redirect is available.

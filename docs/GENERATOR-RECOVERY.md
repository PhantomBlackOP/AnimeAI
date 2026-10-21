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

## Unified AnimeAI website, 2026-10-22 (Malta time)

**Single entry point: `index.html`, served unchanged from both GitHub Pages and SiteGround.** The obsolete `siteground-homepage.html` template was removed.

- `https://animeai.trevorion.io/` (GitHub Pages) serves `index.html` directly, **not a redirect**.
- `https://bsky.trevorion.io/` (SiteGround Node.js) serves the **same index.html bytes**. Its root route simply reads this file.
- Both domains serve the same `animeai-home.js` browser-side renderer and a same-origin `/feed.json`:
  - GitHub Pages serves its public `feed.json` directly.
  - SiteGround exposes `GET /feed.json` from the identical local repository file delivered by GitHub deployment.
- The browser renders the shared RSS-inspired dark-blue layout, mosaic hero, current post/creator statistics, 12 artwork thumbnails, and six latest-post cards with conditional image thumbnails or text-only fallback.
- The HTML/CSS layout is in **`index.html`**. The client-side renderer is **`animeai-home.js`**. The Node service remains in **`siteground-generator.mjs`**.
- This unification is **not** a replacement for the native Bluesky app feed. `https://bsky.app/profile/trevorion.io/feed/animeai` remains the full interactive Bluesky interface.
- Posts tagged with content labels `porn`, `sexual`, `nudity`, or `graphic-media` are excluded from *homepage previews only*, without altering Bluesky feed skeleton posts.
- Public image previews use validated `https://cdn.bsky.app/img/feed_thumbnail/` URLs. User-provided post text is rendered using `textContent`, preventing HTML/script injection. The SiteGround page Content Security Policy permits only same-origin JavaScript/feed requests, inline CSS, and Bluesky CDN imagery.
- The original generator's DID document `/.well-known/did.json` remains on GitHub Pages and points to `https://bsky.trevorion.io`; the registered feed URI and metadata are unchanged.
- `GET /health`, `GET /xrpc/app.bsky.feed.describeFeedGenerator`, and `GET /xrpc/app.bsky.feed.getFeedSkeleton` all remain supported.

### Verification

- Shared homepage/JS DOM unit tests (image thumbnail, text-only fallback, restricted previews, preserved literal post text) and generator smoke tests passed: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39693270604
- **Live independent test confirmed identical HTML and JavaScript on both domains**, valid `feed.json` (216 entries on both during test), unchanged DID service and native generator: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39693365105
- Permanent SiteGround probe workflow: `.github/workflows/probe_siteground.yml`; both-site consistency: `.github/workflows/verify_site_unification.yml`.

### Source-of-truth policy

- GitHub Actions fetches Bluesky posts every six hours and commits `feed.json`.
- GitHub Pages and SiteGround obtain that published static data from the same repository, without additional collecting or a permanent Python server.
- The public website is a **preview** of that collected inventory; Bluesky's own UI remains the place to interact with posts.

## Public homepage Zine navigation, 2026-10-22

At Trevorion's request, remove all user-facing GitHub/code links from the shared `index.html` homepage and substitute meaningful Zine destinations:

- Previous **Raw feed data** card -> **Zine News**, `https://zine.trevorion.io/news/`
- Previous **Open-source project** GitHub card -> **Trevorion Zine**, `https://zine.trevorion.io/`
- Previous **Feed JSON** footer link -> **Zine archive**, `https://zine.trevorion.io/archive/`
- Previous **GitHub** footer link -> **Zine articles**, `https://zine.trevorion.io/articles/`

`Zine RSS`, Bluesky, gallery, latest posts and service status links remain. The underlying public `/feed.json`, GitHub Actions collector, source repository and Bluesky XRPC endpoints are **unchanged**; only the public homepage navigation was edited. Both `animeai.trevorion.io` and `bsky.trevorion.io` serve the same shared `index.html`, so both receive the changes.

Homepage unit tests assert all four Zine destinations are present and GitHub/code UI links are absent. CI: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39693714132. Live two-domain verification: `.github/workflows/verify_site_unification.yml` (inspect the latest completed run before claiming deployment).

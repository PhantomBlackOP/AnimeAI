# AnimeAI native Bluesky feed: SiteGround recovery

Status as of 2026-10-21: **Generator code prepared and CI test PASSED; SiteGround deployment, service DID document, and Bluesky record repair are NOT YET completed.**

Scope: AnimeAI remains Bluesky-only. Zine, RSS, Sitemap and Feeder are unrelated.

## Architecture

1. The existing GitHub Actions collector refreshes \`feed.json\` every six hours from Bluesky. Do **not** change \`.github/workflows/update_feed.yml\`.
2. SiteGround's managed Node.js Project imports \`PhantomBlackOP/AnimeAI\`, branch \`main\`. SiteGround automatically redeploys on every change to that branch, so each new committed \`feed.json\` is deployed.
3. \`siteground-generator.mjs\` reads the **local static \`feed.json\`** in that checkout and returns native Bluesky skeleton responses from the following endpoints:
   - \`/health\`
   - \`/xrpc/app.bsky.feed.describeFeedGenerator\`
   - \`/xrpc/app.bsky.feed.getFeedSkeleton\`
4. The generator's service DID will be \`did:web:animeai.trevorion.io\`, resolved from \`https://animeai.trevorion.io/.well-known/did.json\` hosted by existing GitHub Pages. Its \`#bsky_fg\` service endpoint must point to **the actual final HTTPS SiteGround Node project URL**. This does **not** move or repoint \`animeai.trevorion.io\`; it stays on GitHub Pages.
5. Only after all endpoints work, update the **existing** \`app.bsky.feed.generator/animeai\` record, retaining its AT URI, creation date, name, description, and other metadata. Do not create a second feed.

## SiteGround deployment: operator action required

**Prerequisite:** SiteGround managed Node.js Projects are available on GrowBig, GoGeek and Cloud hosting plans.

In SiteGround Client Area, navigate to **Websites > Node.js Projects > Add New**, select the existing GitHub repository **PhantomBlackOP/AnimeAI**, branch **main**, and deploy as a Node.js application. The repository root contains \`package.json\` with:

\`\`\`
Node.js: 22
Start command: npm start
Build command: none / leave blank if supported
\`\`\`

The project has no npm dependencies and does not need a database or separate scheduled job. SiteGround issues a temporary HTTPS hostname. **Obtain this exact hostname; do not invent it.** When a stable production subdomain is selected, configure the SiteGround project primary domain and its DNS/SSL without altering the existing \`animeai.trevorion.io\` GitHub Pages DNS.

No SiteGround environment variables or Bluesky credentials are required. A read-only authenticated GitHub Actions inspection on 2026-10-21 confirmed that the existing account DID and feed's current service DID are both \`did:plc:c36xxd4j5cyfojgcfgwt7fd5\`. The existing feed AT URI is:

\`\`\`
at://did:plc:c36xxd4j5cyfojgcfgwt7fd5/app.bsky.feed.generator/animeai
\`\`\`

The generator has this verified feed URI as its default. \`FEED_URI\` is an optional override if the feed identity changes. No Bluesky app password is used on SiteGround.

## Verification before changing anything live

From the **actual HTTPS SiteGround domain**, test:

- \`https://<actual-SiteGround-host>/health\`: HTTP 200 with \`status:ok\`, a positive \`posts\` count, and \`configured:true\` (this is now automatic using the verified feed URI).
- \`https://<actual-SiteGround-host>/xrpc/app.bsky.feed.describeFeedGenerator\`: HTTP 200 with \`did:"did:web:animeai.trevorion.io"\` and the unchanged original \`FEED_URI\`.
- \`https://<actual-SiteGround-host>/xrpc/app.bsky.feed.getFeedSkeleton?feed=<URL-encoded-FEED_URI>&limit=2\`: HTTP 200 containing actual Bluesky \`at://\` posts and a cursor.

After verifying the stable endpoint, publish **exactly one** GitHub Pages DID document at \`.well-known/did.json\`, with \`id:did:web:animeai.trevorion.io\`, \`service[0].id:"#bsky_fg"\`, \`service[0].type:"BskyFeedGenerator"\`, and \`serviceEndpoint\` set to the **verified actual HTTPS SiteGround origin**. Use a root \`.nojekyll\` if GitHub Pages otherwise excludes \`.well-known\`. Independently verify the live public URL serves JSON.

Example template only, **do not publish with placeholders**:

\`\`\`json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:web:animeai.trevorion.io",
  "service": [{
    "id": "#bsky_fg",
    "type": "BskyFeedGenerator",
    "serviceEndpoint": "https://REPLACE_WITH_VERIFIED_SITEGROUND_HOST"
  }]
}
\`\`\`

Finally use the **manual** GitHub Actions workflow \`Repair existing AnimeAI Bluesky feed registration\`. It uses existing repository secrets \`BSKY_APP_USERNAME\` and \`BSKY_APP_PASSWORD\`, first validates the live DID document and skeleton on a dry run, and only changes the old record when its \`apply\` checkbox is set. This preserves the original feed URI and guards the write with a CID compare-and-swap. Neither a local password nor a new Bluesky feed is needed.

Afterwards check the original feed inside Bluesky. Confirm pagination and new results after the next six-hourly \`feed.json\` refresh.

## What has already been done

- Added \`siteground-generator.mjs\` and dependency-free \`package.json\`.
- Added \`tests/generator-smoke.test.mjs\` and \`.github/workflows/test_generator.yml\`.
- GitHub Actions smoke test **passed**: https://github.com/PhantomBlackOP/AnimeAI/actions/runs/39682178291
- Added \`.github/workflows/repair_feed_registration.yml\`, using the already configured repository Bluesky credentials for a manually authorized repair.
- Existing GitHub collector, site DNS, account DID, feed JSON content, and original Bluesky feed registration were **not** changed.
- Removed unused prototype Vercel-only source files after choosing SiteGround.

Do not claim the native feed is repaired until SiteGround hosting and the DID/Bluesky registration are verified live.

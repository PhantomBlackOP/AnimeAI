# AnimeAI native Bluesky generator recovery (2026-10-21)

Status: **API code staged in GitHub; NOT deployed; existing Bluesky feed NOT updated.**
Scope: Remain Bluesky-only. Do not integrate WordPress, Sitemap, RSS or Feeder.

## Why this is necessary

The GitHub Actions jobs still generate \`feed.json\` every six hours from Bluesky.
That file is **not** itself an AT Protocol service. The earlier Flask generator
uses a sample \`python\` filter and does not consume \`feed.json\`.
Bluesky currently reports: "invalid feed generator service details in did document."

## Proposed non-disruptive architecture

- Existing: \`.github/workflows/update_feed.yml\` writes \`feed.json\`.
- New, ready for hosting: \`api/skeleton.mjs\` reads and validates the current public
  \`feed.json\`, returns only Bluesky AT URIs, supports limits and stable cursors.
- New: \`api/describe.mjs\` advertises the existing feed URI; \`vercel.json\` maps
  the exact XRPC paths to the functions.
- The **live function** can be hosted from this GitHub repository on Vercel, on a
  separate generated \`*.vercel.app\` HTTPS hostname. GitHub Pages remains the
  existing website; it does not execute these functions.
- Planned **service DID**: \`did:web:animeai.trevorion.io\`, served from
  \`https://animeai.trevorion.io/.well-known/did.json\` on GitHub Pages.
  Its \`BskyFeedGenerator\` serviceEndpoint points to the *actual* deployed Vercel
  hostname. Use that actual hostname, never a guessed URL or placeholder.
- **Do not** change the user's existing Bluesky account DID. Update only the
  generator DID reference inside the **existing feed record**.

## Activation sequence (do not skip steps)

1. Deploy **this repository** to Vercel as a plain project (no build framework
   required). Keep its generated HTTPS deployment hostname stable.
2. Configure Vercel environment variables:
   - \`FEEDGEN_DID=did:web:animeai.trevorion.io\`
   - \`FEED_URI=at://<the-current-feed-owner-DID>/app.bsky.feed.generator/animeai\`
   The value of FEED_URI must be fetched from the *actual existing* Bluesky
   record, not guessed from the error screenshot. No Bluesky app password is
   needed in Vercel because API reads public GitHub JSON.
3. Verify Vercel:
   - \`https://<actual-host>/xrpc/app.bsky.feed.describeFeedGenerator\`
   - \`https://<actual-host>/xrpc/app.bsky.feed.getFeedSkeleton?feed=<urlencoded-FEED_URI>&limit=2\`
   Description must contain both expected DID and existing feed URI;
   skeleton must return at least one valid \`at://did:...\` post URI.
4. **Only after live endpoint is verified**, publish
   \`.well-known/did.json\` on the GitHub Pages site, with:
   \`\`\`json
   {
     "@context": ["https://www.w3.org/ns/did/v1"],
     "id": "did:web:animeai.trevorion.io",
     "service": [{
       "id": "#bsky_fg",
       "type": "BskyFeedGenerator",
       "serviceEndpoint": "https://<actual-live-vercel-host>"
     }]
   }
   \`\`\`
   GitHub Pages uses Jekyll by default, which can omit dot-prefixed folders.
   Add an empty \`.nojekyll\` file at repository root if needed; preserve the
   existing \`CNAME\`. **Independently fetch** the public DID JSON and verify it.
5. From a trusted operator environment, using a dedicated Bluesky app password:
   \`\`\`sh
   export BSKY_APP_USERNAME='trevorion.io'
   export BSKY_APP_PASSWORD='<app-password>'
   python scripts/repair_feed_registration.py
   python scripts/repair_feed_registration.py --apply
   \`\`\`
   The first invocation is a dry run and validates the DID document, live
   description and actual skeleton. Only \`--apply\` changes the record using
   \`com.atproto.repo.putRecord\` with the **same** owner/rkey, preserving
   display name, description, avatar and record creation date. It uses the old
   record CID for compare-and-swap. Do NOT use \`createRecord\`; that risks
   duplicate creation or collision.
6. Verify the original feed opens in Bluesky, posts load, and pagination works.
   Recheck after the next successful six-hourly GitHub collection run.

## Not changed

The collector, existing GitHub Actions workflows, existing \`feed.json\`,
existing account DID, GitHub Pages branding, and original Bluesky feed record
have **not** been modified by staging the new API files.

## Cautions

- Deploying Vercel requires connecting/authorizing a hosting account. GitHub
  source control alone cannot serve live XRPC functions.
- Never put an app password in repository files or commit logs.
- A successful GitHub Actions run is not a successful native Bluesky feed.
- Keep the old server files intact until the deployed replacement is verified.
- If the identity/hosting inspection disagrees with the assumptions above,
  stop and reconcile the actual feed declaration before any write.

#!/usr/bin/env python3
"""Repair the EXISTING AnimeAI feed declaration, without creating a new feed.

This script is inert unless --apply is passed. It first validates the service
DID document, the generator description and an actual non-empty feed skeleton.
Uses a Bluesky app password from environment variables, never from source.
"""
import argparse
import json
import os
import urllib.parse
import urllib.request

from atproto import Client, models

RECORD_NAME = "animeai"
SERVICE_DID = "did:web:animeai.trevorion.io"
DID_DOCUMENT = "https://animeai.trevorion.io/.well-known/did.json"


def get_json(url):
    req = urllib.request.Request(
        url, headers={"Accept": "application/json", "User-Agent": "AnimeAI-generator-verifier/1.0"}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return json.load(response)


def validate_service(expected_uri):
    did_doc = get_json(DID_DOCUMENT)
    if did_doc.get("id") != SERVICE_DID:
        raise RuntimeError("DID document identity mismatch; leaving existing feed untouched")

    matches = [
        service for service in did_doc.get("service", [])
        if service.get("type") == "BskyFeedGenerator"
        and service.get("id", "").endswith("#bsky_fg")
    ]
    if len(matches) != 1:
        raise RuntimeError("DID document does not have one BskyFeedGenerator service")

    endpoint = matches[0].get("serviceEndpoint", "").rstrip("/")
    parts = urllib.parse.urlsplit(endpoint)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise RuntimeError("Invalid HTTPS feed service endpoint")

    description = get_json(endpoint + "/xrpc/app.bsky.feed.describeFeedGenerator")
    if description.get("did") != SERVICE_DID:
        raise RuntimeError("Live generator description has wrong service DID")
    if expected_uri not in [
        item.get("uri") for item in description.get("feeds", [])
    ]:
        raise RuntimeError("Live generator does not advertise the existing AnimeAI feed")

    query = urllib.parse.urlencode({"feed": expected_uri, "limit": "2"})
    skeleton = get_json(endpoint + "/xrpc/app.bsky.feed.getFeedSkeleton?" + query)
    posts = skeleton.get("feed", [])
    if not posts or not all(
        isinstance(item.get("post"), str)
        and item["post"].startswith("at://did:")
        and "/app.bsky.feed.post/" in item["post"]
        for item in posts
    ):
        raise RuntimeError("Live generator returned no valid Bluesky post skeleton")

    print("Verified service:", endpoint)
    print("Verified skeleton posts:", len(posts))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the existing-feed update")
    args = parser.parse_args()

    username = os.environ.get("BSKY_APP_USERNAME")
    password = os.environ.get("BSKY_APP_PASSWORD")
    if not username or not password:
        raise RuntimeError("Missing BSKY_APP_USERNAME or BSKY_APP_PASSWORD environment setting")

    client = Client()
    client.login(username, password)

    repo = client.me.did
    collection = models.ids.AppBskyFeedGenerator
    feed_uri = "at://" + repo + "/" + collection + "/" + RECORD_NAME

    existing = client.com.atproto.repo.get_record(
        models.ComAtprotoRepoGetRecord.Params(
            repo=repo, collection=collection, rkey=RECORD_NAME
        )
    )
    previous_did = existing.value.get("did") if isinstance(existing.value, dict) else existing.value.did
    if not previous_did:
        raise RuntimeError("Existing feed has no service DID; refusing to replace the record")

    print("Existing feed URI:", existing.uri)
    print("Existing service DID:", previous_did)
    print("Target service DID:", SERVICE_DID)

    validate_service(feed_uri)

    if not args.apply:
        print("DRY RUN ONLY. No Bluesky records changed. Pass --apply after review.")
        return

    if isinstance(existing.value, dict):
        existing.value["did"] = SERVICE_DID
    else:
        existing.value.did = SERVICE_DID

    result = client.com.atproto.repo.put_record(
        models.ComAtprotoRepoPutRecord.Data(
            repo=repo,
            collection=collection,
            rkey=RECORD_NAME,
            record=existing.value,
            swap_record=existing.cid,
        )
    )
    if result.uri != feed_uri:
        raise RuntimeError("Unexpected feed URI after write: " + result.uri)
    print("Updated existing feed:", result.uri)
    print("Record CID:", result.cid)


if __name__ == "__main__":
    main()

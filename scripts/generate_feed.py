import os
import json
from atproto import Client
from atproto_client.models.app.bsky.feed.get_author_feed import Params
from server.discovery import load_cached_handles
from server.algos.animeai import HASHTAGS

# 🧹 Smarter post filtering
def is_valid_post(post: dict) -> bool:
    body = post.get("record", {}).get("text", "").strip().lower()
    hashtags = post.get("tags", [])

    # Accept if tagged with known signal topics
    whitelist_tags = ["#aianime", "#aiart", "#animecommunity", "#generativeai", "#aicommunity"]
    if any(tag in hashtags for tag in whitelist_tags):
        return True

    # Accept if body looks human-ish
    if body and len(body) >= 15 and post.get("type") == "app.bsky.feed.post":
        blacklist = ["refer", "credit card", "sign up", "campaign", "promo", "bybit"]
        return not any(p in body for p in blacklist)
    return False

# 🔁 Deduplicate by cid or uri
def deduplicate_posts(posts: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for post in posts:
        key = post.get("cid") or post.get("uri")
        if key and key not in seen:
            seen.add(key)
            unique.append(post)
    return unique

# 🔗 Rebuild handle-to-tag map (for tagging accuracy)
def build_handle_tag_map(hashtags: set[str], limit_per_tag: int = 50) -> dict[str, list[str]]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    tag_map: dict[str, list[str]] = {}
    for tag in hashtags:
        query = tag.lstrip("#")
        params = Params(q=query, sort="latest", limit=limit_per_tag)
        try:
            response = client.app.bsky.feed.search_posts(params)
        except Exception as e:
            print(f"⚠️ Failed search for #{query}: {e}")
            continue

        for post in response.posts:
            handle = post.author.handle
            tag_map.setdefault(handle, []).append(f"#{query}")

        print(f"✅ #{query}: {len(response.posts)} posts")
    return tag_map

# 🧠 Fetch and tag posts
def fetch_tagged_posts(handle_tag_map: dict[str, list[str]], limit: int = 3) -> list[dict]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    posts = []
    for handle, hashtags in handle_tag_map.items():
        try:
            params = Params(actor=handle, limit=limit)
            response = client.app.bsky.feed.get_author_feed(params)
            for item in response.feed:
                post_data = item.post.model_dump()
                post_data["tags"] = hashtags
                post_data["author"] = handle

                if is_valid_post(post_data):
                    posts.append(post_data)
                else:
                    print(f"🗑️ Rejected post from {handle}: {post_data['record'].get('text')}")
        except Exception as e:
            print(f"⚠️ Failed to fetch from {handle}: {e}")
    return posts

# 📦 Save final feed
def save_feed(posts: list[dict], path: str = '../feed.json'):
    feed_path = os.path.join(os.path.dirname(__file__), path)
    os.makedirs(os.path.dirname(feed_path), exist_ok=True)
    with open(feed_path, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
    print(f"📦 Saved {len(posts)} curated posts to feed.json")

# 🚀 Run
if __name__ == "__main__":
    # Option A: Use cached handles
    handles = load_cached_handles()
    handle_tag_map = {handle: [] for handle in handles}

    # Option B: Use rediscovered tag map
    # handle_tag_map = build_handle_tag_map(HASHTAGS)

    raw_posts = fetch_tagged_posts(handle_tag_map)
    deduped = deduplicate_posts(raw_posts)
    save_feed(deduped)

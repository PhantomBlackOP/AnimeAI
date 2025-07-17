import os
import json
from atproto import Client
from atproto_client.models.app.bsky.feed.search_posts import Params as SearchParams
from atproto_client.models.app.bsky.feed.get_author_feed import Params as AuthorParams
from server.discovery import load_cached_handles
from server.algos.animeai import HASHTAGS

rejected_posts = []

# 🧹 Filter posts
def is_valid_post(post: dict) -> bool:
    body = post.get("record", {}).get("text", "").strip().lower()
    hashtags = post.get("tags", [])

    whitelist_tags = ["#aianime", "#aiart", "#animecommunity", "#generativeai", "#aicommunity"]
    if any(tag.lower() in [ht.lower() for ht in hashtags] for tag in whitelist_tags):
        return True

    blacklist = ["refer", "credit card", "sign up", "campaign", "promo", "bybit"]
    if body and len(body) >= 15 and post.get("type") == "app.bsky.feed.post":
        return not any(p in body for p in blacklist)

    return False

# 🔁 Deduplicate by cid/uri
def deduplicate_posts(posts: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for post in posts:
        key = post.get("cid") or post.get("uri")
        if key and key not in seen:
            seen.add(key)
            unique.append(post)
    return unique

# 🔗 Build hashtag-to-handle map
def build_handle_tag_map(hashtags: set[str], limit_per_tag: int = 50) -> dict[str, list[str]]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    tag_map: dict[str, list[str]] = {}
    for tag in hashtags:
        query = tag.lstrip("#")
        params = SearchParams(q=query, sort="latest", limit=limit_per_tag)
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

# 🧠 Fetch posts
def fetch_tagged_posts(handle_tag_map: dict[str, list[str]], limit: int = 3) -> list[dict]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    posts = []
    for handle, hashtags in handle_tag_map.items():
        try:
            params = AuthorParams(actor=handle, limit=limit)
            response = client.app.bsky.feed.get_author_feed(params)
            print(f"🔍 {handle}: {len(response.feed)} posts")

            for item in response.feed:
                post_data = item.post.model_dump()
                post_data["tags"] = hashtags
                post_data["author"] = handle

                if is_valid_post(post_data):
                    posts.append(post_data)
                else:
                    rejected_posts.append(post_data)
        except Exception as e:
            print(f"⚠️ Failed to fetch from {handle}: {e}")
    return posts

# 📦 Save curated posts
def save_feed(posts: list[dict], filename: str = '../feed.json'):
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), filename))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
    print(f"📦 Saved {len(posts)} curated posts to {path}")

# 📤 Save rejected posts
def save_rejected(posts: list[dict], filename: str = '../rejected_debug.json'):
    path = os.path.abspath(os.path.join(os.path.dirname(__file__), filename))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(posts, f, indent=2)
    print(f"📤 Saved {len(posts)} rejected posts to {path}")

# 🚀 Main run block
if __name__ == "__main__":
    handles = load_cached_handles()
    handle_tag_map = build_handle_tag_map(HASHTAGS)

    raw_posts = fetch_tagged_posts(handle_tag_map)
    deduped = deduplicate_posts(raw_posts)

    print(f"🧪 Pre-save: fetched={len(raw_posts)} deduped={len(deduped)}")
    save_feed(deduped)
    save_rejected(rejected_posts)

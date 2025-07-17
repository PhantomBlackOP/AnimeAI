# server/storage.py
from atproto import Client
from common.types import Post
import os

def get_all_posts() -> list[Post]:
    # 🔐 Login credentials from environment variables
    client = Client()
    client.login(
        os.getenv("BSKY_APP_USERNAME"),
        os.getenv("BSKY_APP_PASSWORD")
    )

    # 📡 Fetch recent posts from a specific handle
    handle = "anime.bsky.social"  # You can change this to any valid Bluesky username
    profile = client.app.bsky.actor.get_profile(handle)
    feed = client.app.bsky.feed.get_author_feed(profile.did, limit=50)

    posts = []
    for item in feed.feed:
        record = item.post.record
        posts.append(Post(
            uri=item.post.uri,
            cid=item.post.cid,
            text=record.get("text", "")
        ))

    print(f"Retrieved {len(posts)} live posts from {handle}")
    return posts

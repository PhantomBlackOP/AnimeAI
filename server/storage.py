# server/storage.py
from atproto import Client
from atproto_client.models.app.bsky.actor.get_profile import Params
from common.types import Post
import os

def get_all_posts_from_handles(handles: list[str], posts_per_handle: int = 25) -> list[Post]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    all_posts = []
    for handle in handles:
        try:
            profile = client.app.bsky.actor.get_profile(Params(actor=handle))
            feed = client.app.bsky.feed.get_author_feed(profile.did, limit=posts_per_handle)

            for item in feed.feed:
                record = item.post.record
                all_posts.append(Post(
                    uri=item.post.uri,
                    cid=item.post.cid,
                    text=record.get("text", "")
                ))
        except Exception as e:
            print(f"⚠️ Failed to fetch posts from {handle}: {e}")

    print(f"📡 Pulled {len(all_posts)} posts from {len(handles)} handles")
    return all_posts


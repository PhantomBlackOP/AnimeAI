from atproto import Client
from atproto_client.models.app.bsky.feed.search_posts import Params
import os

def discover_handles_by_hashtags(hashtags: set[str], limit_per_tag: int = 50) -> set[str]:
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    discovered_handles = set()

    for tag in hashtags:
        query = tag.lstrip("#")  # Remove '#' for API query
        params = Params(q=query, sort="latest", limit=limit_per_tag)
        response = client.app.bsky.feed.search_posts(params)

        for post in response.posts:
            discovered_handles.add(post.author.handle)

        print(f"✅ Found {len(response.posts)} posts for #{query}")

    print(f"🎯 Total unique handles discovered: {len(discovered_handles)}")
    return discovered_handles

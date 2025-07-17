import os
import json
from atproto import Client
from atproto_client.models.app.bsky.feed.search_posts import Params
from server.algos.animeai import HASHTAGS

def discover_handles_by_hashtags(hashtags: set[str], limit_per_tag: int = 50) -> set[str]:
    """
    Search Bluesky for recent posts matching a set of hashtags,
    and extract the author handles from those posts.

    Caches results to 'handles.json' in repo root.
    """
    client = Client()
    client.login(os.getenv("BSKY_APP_USERNAME"), os.getenv("BSKY_APP_PASSWORD"))

    discovered_handles = set()

    for tag in hashtags:
        query = tag.lstrip("#")  # Bluesky API expects plain text, not prefixed hash
        params = Params(q=query, sort="latest", limit=limit_per_tag)
        try:
            response = client.app.bsky.feed.search_posts(params)
        except Exception as e:
            print(f"⚠️ Failed search for #{query}: {e}")
            continue

        for post in response.posts:
            discovered_handles.add(post.author.handle)

        print(f"✅ #{query}: {len(response.posts)} posts, {len(discovered_handles)} total handles")

    # 📝 Write to cache file
    cache_path = os.path.join(os.path.dirname(__file__), '../handles.json')
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(sorted(discovered_handles), f, indent=2)

    print(f"📦 Cached {len(discovered_handles)} unique handles to handles.json")
    return discovered_handles


def load_cached_handles() -> list[str]:
    """
    Load previously discovered handles from 'handles.json'.
    Returns an empty list if file is missing or unreadable.
    """
    cache_path = os.path.join(os.path.dirname(__file__), '../handles.json')
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Failed to load cached handles: {e}")
    return []

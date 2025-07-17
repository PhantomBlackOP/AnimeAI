from server.discovery import discover_handles_by_hashtags
from server.storage import get_all_posts_from_handles
from server.algos.animeai import animeai_algo, HASHTAGS
import json
import os

FEED_PATH = os.path.join(os.path.dirname(__file__), '../feed.json')

def generate_feed():
    # 🌐 Discover authors based on AnimeAI hashtags
    handles = discover_handles_by_hashtags(HASHTAGS, limit_per_tag=50)

    # 📡 Fetch their latest posts
    posts = get_all_posts_from_handles(handles, posts_per_handle=25)

    # 🎚️ Filter posts using your aesthetic algo
    curated = animeai_algo(posts)

    # 💾 Save to feed.json
    with open(FEED_PATH, 'w', encoding='utf-8') as f:
        json.dump(curated, f, indent=2, ensure_ascii=False)

    print(f"✅ Saved {len(curated)} curated posts to feed.json")

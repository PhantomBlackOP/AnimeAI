import sys
import os

# Add repo root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
from server.algos.animeai import animeai_algo, HASHTAGS
from server.storage import get_all_posts_from_handles
from server.discovery import discover_handles_by_hashtags

def generate_feed():
    handles = discover_handles_by_hashtags(HASHTAGS)
    posts = get_all_posts_from_handles(handles)
    uris = animeai_algo(posts)

    feed = {
        "feed": [{"uri": uri, "cid": "placeholder-cid"} for uri in uris]
    }

    with open("feed.json", "w") as f:
        json.dump(feed, f, indent=2)

if __name__ == "__main__":
    generate_feed()
    print("feed.json updated!")

import sys
import os

# Add repo root to Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
from server.algos.animeai import animeai_algo
from server.storage import get_all_posts

def generate_feed():
    posts = get_all_posts()
    uris = animeai_algo(posts)

    feed = {
        "feed": [{"uri": uri, "cid": "placeholder-cid"} for uri in uris]
    }

    with open("main/feed.json", "w") as f:
        json.dump(feed, f, indent=2)

if __name__ == "__main__":
    generate_feed()
    print("feed.json updated!")

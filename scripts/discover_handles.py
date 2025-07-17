from server.discovery import discover_handles_by_hashtags
from server.algos.animeai import HASHTAGS

if __name__ == "__main__":
    # Run discovery and cache handles in handles.json
    discover_handles_by_hashtags(HASHTAGS, limit_per_tag=50)

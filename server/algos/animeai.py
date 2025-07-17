from typing import List
from common.types import Post

# Hashtags to include in the feed
HASHTAGS = {
    '#ai', '#aiart', '#aianime', '#aicommunity', '#ainews',
    '#animenews', '#animecommunity', '#chatgpt',
    '#copilot', '#generativeai', '#grok'
}

def animeai_algo(posts: List[Post]) -> List[str]:
    matched_uris = []

    for post in posts:
        if any(tag in post.text.lower() for tag in HASHTAGS):
            matched_uris.append(post.uri)

    return matched_uris

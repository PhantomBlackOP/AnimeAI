# server/storage.py
from common.types import Post

def get_all_posts() -> list[Post]:
    # Placeholder stub — replace with real logic
    return [
        Post(uri="at://example.com/post1", cid="cid123", text="Post one text"),
        Post(uri="at://example.com/post2", cid="cid456", text="Post two text"),
    ]

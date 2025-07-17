import os
from atproto import Client, models

# Load environment variables
USERNAME = os.getenv("BSKY_USERNAME")
PASSWORD = os.getenv("BSKY_PASSWORD")
HOSTNAME = os.getenv("HOSTNAME")
FEED_ID = "animeai"

if not all([USERNAME, PASSWORD, HOSTNAME]):
    raise RuntimeError("Missing BSKY_USERNAME, BSKY_PASSWORD, or HOSTNAME in environment.")

# Construct display metadata
display_name = "AnimeAI Stream"
description = "A mythic AI-powered Bluesky stream curated by AnimeAI."

# Initialize Bluesky client
client = Client()
client.login(USERNAME, PASSWORD)

# Create feed generator record object using correct structure
from datetime import datetime

feed_record = models.ComAtprotoRepoCreateRecord.Data(
    repo=client.me.did,
    collection="app.bsky.feed.generator",
    record={
        "$type": "app.bsky.feed.generator",
        "did": client.me.did,
        "displayName": display_name,
        "description": description,
        "serviceEndpoint": f"https://{HOSTNAME}",
        "createdAt": datetime.utcnow().isoformat() + "Z",  # 🕓 Timestamp added!
    },
    rkey=FEED_ID,
    validate=True
)

# Publish the feed generator record to your repo
client.com.atproto.repo.create_record(feed_record)

# Print the resulting FEED_URI
feed_uri = f"at://{client.me.did}/app.bsky.feed.generator/{FEED_ID}"
print(f"\n✅ Feed published successfully!")
print(f"🔗 FEED_URI: {feed_uri}\n")

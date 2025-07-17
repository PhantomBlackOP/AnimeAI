from atproto import Client, models
import os

# Load environment variables
USERNAME = os.getenv("BSKY_USERNAME")
PASSWORD = os.getenv("BSKY_PASSWORD")
HOSTNAME = os.getenv("HOSTNAME")
FEED_ID = "animeai"

if not all([USERNAME, PASSWORD, HOSTNAME]):
    raise RuntimeError("Missing BSKY_USERNAME, BSKY_PASSWORD, or HOSTNAME in environment.")

# Construct full feed URI
feed_uri = f"at://{USERNAME}/app.bsky.feed.generator/{FEED_ID}"

# Compose metadata
display_name = "AnimeAI Stream"
description = "A mythic AI-powered Bluesky stream curated by AnimeAI."

# Initialize Bluesky client
client = Client()
client.login(USERNAME, PASSWORD)

# Register feed generator record
client.app.bsky.feed.generator.create_record(
    models.AppBskyFeedGenerator.Record(
        did=client.me.did,
        displayName=display_name,
        description=description,
        serviceEndpoint=f"https://{HOSTNAME}",
    )
)

print(f"✅ Feed published! Your FEED_URI is:\n{feed_uri}")

# Upstream Python attribution

The retained Python feed-generator scaffold is based on the [AT Protocol SDK for Python](https://github.com/MarshalX/atproto) feed-generator example.

Its MIT copyright notice, Copyright (c) 2023 Ilya Siamionau, is preserved in [BS LICENSE](BS%20LICENSE). Keep that notice with copies or substantial portions of the upstream software.

The original Flask, SQLite, and firehose setup instructions no longer describe AnimeAI's deployed service. Production uses `siteground-generator.mjs` and the static `feed.json` snapshot. The scheduled Python collectors still import parts of `server/`.

See the [current README](README.md) and [deployment and maintenance guide](docs/GENERATOR-RECOVERY.md) for this repository's supported operating procedure.

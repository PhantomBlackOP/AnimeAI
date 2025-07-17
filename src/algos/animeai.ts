import { FeedSkeleton, FeedItemType } from '../types'

export const animeai = async (): Promise<FeedSkeleton> => {
  const skeleton: FeedItemType[] = []

  // Example: Check each post and add it if it includes #aiart or #aianime
  for (const post of yourIndexedPosts) {
    if (
      post.text.includes('#ai') ||
      post.text.includes('#aiart') ||
      post.text.includes('#aianime') ||
      post.text.includes('#aicommunity') ||
      post.text.includes('#ainews') ||
      post.text.includes('#animenews') ||
      post.text.includes('#animecommunity') ||
      post.text.includes('#chatgpt') ||
      post.text.includes('#copilot') ||
      post.text.includes('#generativeai') ||
      post.text.includes('#grok')
    ) {
      skeleton.push({
        uri: post.uri,
        cid: post.cid,
      })
    }
  }

  return {
    feed: skeleton,
  }
}

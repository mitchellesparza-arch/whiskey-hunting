import { NextResponse }           from 'next/server'
import { Redis }                   from '@upstash/redis'
import { searchReddit, searchRedditDropThreads, searchRSS, searchTwitter } from '../../../lib/social.js'
import { sendSocialEmail }         from '../../../lib/email.js'

function getRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

const SEEN_TTL = 7 * 24 * 60 * 60  // 7 days in seconds

export async function GET(request) {
  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checkedAt = new Date().toISOString()
  const redis     = getRedis()

  // Run all sources concurrently
  const [redditPosts, dropThreadPosts, rssPosts, twitterPosts] = await Promise.all([
    searchReddit(),
    searchRedditDropThreads(),
    searchRSS(),
    searchTwitter(),
  ])

  const allPosts = [...redditPosts, ...dropThreadPosts, ...rssPosts, ...twitterPosts]

  // Deduplicate against Redis — only keep posts we haven't emailed before
  const newPosts = []
  for (const post of allPosts) {
    const key  = `wh:social:seen:${post.id}`
    const seen = await redis.get(key)
    if (!seen) {
      await redis.setex(key, SEEN_TTL, '1')
      newPosts.push(post)
    }
  }

  // Newest first
  newPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  let emailSent = false
  if (newPosts.length > 0) {
    await sendSocialEmail(newPosts, checkedAt)
    emailSent = true
  }

  return NextResponse.json({
    checkedAt,
    redditFound:      redditPosts.length,
    dropThreadFound:  dropThreadPosts.length,
    rssFound:         rssPosts.length,
    twitterFound:     twitterPosts.length,
    newPosts:         newPosts.length,
    emailSent,
    posts: newPosts.map(p => ({
      id:     p.id,
      source: p.source,
      label:  p.label,
      title:  p.title.slice(0, 100),
    })),
  })
}

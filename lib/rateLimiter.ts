import { NextRequest } from 'next/server'
import { LRUCache } from 'lru-cache'
import { RATE_LIMIT } from './constants'
import { ApiError } from './errors'

const rateLimitCache = new LRUCache<string, number>({
  max: RATE_LIMIT.CACHE_MAX_SIZE,
  ttl: RATE_LIMIT.CACHE_TTL_MS
})

export const rateLimiter = async (req: NextRequest) => {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
  const limit = RATE_LIMIT.REQUESTS_PER_MINUTE
  const currentCount = (rateLimitCache.get(ip) || 0) as number

  if (currentCount >= limit) {
    throw new ApiError(
      429,
      'Rate limit exceeded. Please try again later.',
      { limitResetTime: new Date(Date.now() + RATE_LIMIT.CACHE_TTL_MS).toISOString() }
    )
  }

  rateLimitCache.set(ip, currentCount + 1)
}
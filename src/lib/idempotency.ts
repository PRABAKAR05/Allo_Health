import redis from "./redis";

interface IdempotencyResult {
  exists: boolean;
  cachedResponse?: {
    status: number;
    body: Record<string, unknown>;
  };
}

/**
 * Check if an idempotency key has a cached response.
 */
export async function checkIdempotencyKey(
  key: string
): Promise<IdempotencyResult> {
  if (!redis) return { exists: false };

  try {
    const cached = await redis.get<{
      status: number;
      body: Record<string, unknown>;
    }>(`idempotency:${key}`);

    if (cached) {
      return { exists: true, cachedResponse: cached };
    }

    return { exists: false };
  } catch {
    // If Redis is down, proceed without idempotency
    return { exists: false };
  }
}

/**
 * Cache the response for an idempotency key.
 * TTL defaults to 24 hours.
 */
export async function cacheIdempotencyResponse(
  key: string,
  status: number,
  body: Record<string, unknown>,
  ttlSeconds: number = 86400
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      `idempotency:${key}`,
      JSON.stringify({ status, body }),
      { ex: ttlSeconds }
    );
  } catch {
    // If Redis is down, just skip caching
  }
}

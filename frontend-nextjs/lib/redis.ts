import "server-only";

import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<RedisClient> | null = null;

const getRedisUrl = () => {
  return process.env.REDIS_URL ?? null;
};

export const getRedisClient = async () => {
  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    return null;
  }

  if (!redisClientPromise) {
    const client = createClient({ url: redisUrl });
    redisClientPromise = client.connect().then(() => client);
  }

  return redisClientPromise;
};

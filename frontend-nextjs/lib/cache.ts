import "server-only";

import { getRedisClient } from "@/lib/redis";

const userContextKey = (email: string) => `user_email:${email}:context`;

export const invalidateUserContextCache = async (email: string) => {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  await redis.del(userContextKey(email));
  return true;
};

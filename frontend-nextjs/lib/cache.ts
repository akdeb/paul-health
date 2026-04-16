import "server-only";

import { getRedisClient } from "@/lib/redis";

const userContextKey = (email: string) => `user_email:${email}:context`;
const userChatHistoryKey = (userId: string) => `user:${userId}:chat_history`;
const userContextTtlSeconds = Number.parseInt(
  process.env.USER_CONTEXT_TTL_SECONDS ?? "604800",
  10,
);

export const setUserContextCache = async (email: string, user: IUser) => {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  await redis.set(
    userContextKey(email),
    JSON.stringify({ user }),
    { EX: userContextTtlSeconds },
  );
  return true;
};

export const clearUserChatHistoryCache = async (userId: string) => {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  await redis.del(userChatHistoryKey(userId));
  return true;
};

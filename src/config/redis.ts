import Redis from "ioredis";
import { logger } from "../utils";

const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

export const redis = new Redis(redisConfig);

redis.on("connect", () => {
  // logger.info("✅ Redis connected successfully");
});

redis.on("error", (error) => {
  logger.error("❌ Redis connection failed:", error);
});

export default redis;

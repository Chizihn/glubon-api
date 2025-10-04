import cron from "node-cron";
import { redis } from "../config";
import { logger } from "../utils";

// Run every hour to clean up expired cache entries
cron.schedule("0 * * * *", async () => {
  try {
    // logger.info("Running cache invalidation job...");
    
    // Get all cache keys with TTL
    const keys = await redis.keys("*");
    let expiredCount = 0;
    
    for (const key of keys) {
      try {
        const ttl = await redis.ttl(key);
        
        // If key has expired (TTL = -2) or is set to expire (TTL = -1)
        if (ttl === -2 || ttl === -1) {
          await redis.del(key);
          expiredCount++;
        }
      } catch (error) {
        logger.error(`Error processing cache key ${key}:`, error);
      }
    }
    
    // logger.info(`Cache invalidation complete. Removed ${expiredCount} expired entries.`);
    
    // Clear any expired sessions (if using Redis for sessions)
    // This is just an example - adjust based on your session implementation
    const sessionKeys = await redis.keys("sess:*");
    let sessionCleanupCount = 0;
    
    for (const key of sessionKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -2 || ttl === -1) {
        await redis.del(key);
        sessionCleanupCount++;
      }
    }
    
    if (sessionCleanupCount > 0) {
      logger.info(`Cleaned up ${sessionCleanupCount} expired sessions.`);
    }
    
  } catch (error) {
    logger.error("Error in cache invalidation job:", error);
  }
});

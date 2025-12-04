import cron from "node-cron";
import { redis } from "../config";
import { logger } from "../utils";

/**
 * DISABLED: Cache invalidation job
 * 
 * This job has been disabled because:
 * 1. Redis automatically evicts expired keys - manual cleanup is unnecessary
 * 2. TTL = -2 means key doesn't exist (already deleted by Redis)
 * 3. TTL = -1 means key has no expiration (permanent) - deleting these is wrong
 * 4. Uses redis.keys("*") which BLOCKS entire Redis instance at scale
 * 5. At 100K+ keys, this would cause 5-10 second outages every hour
 * 
 * If you need cache cleanup logic, use SCAN instead of KEYS and only
 * clean up keys that have business logic reasons to be invalidated.
 * 
 * For reference, the old implementation is commented below.
 */

// DISABLED - DO NOT RE-ENABLE WITHOUT FIXING
// cron.schedule("0 * * * *", async () => {
//   try {
//     logger.info("Running cache invalidation job...");
//     
//     // DANGER: redis.keys() blocks entire Redis instance!
//     const keys = await redis.keys("*");
//     let expiredCount = 0;
//     
//     for (const key of keys) {
//       try {
//         const ttl = await redis.ttl(key);
//         
//         // TTL = -2: key doesn't exist
//         // TTL = -1: key has no expiration (permanent)
//         if (ttl === -2 || ttl === -1) {
//           await redis.del(key);
//           expiredCount++;
//         }
//       } catch (error) {
//         logger.error(`Error processing cache key ${key}:`, error);
//       }
//     }
//     
//     logger.info(`Cache invalidation complete. Removed ${expiredCount} expired entries.`);
//     
//   } catch (error) {
//     logger.error("Error in cache invalidation job:", error);
//   }
// });

logger.info("Cache invalidator job is disabled (Redis handles expiration automatically)");

import type { Request, Response, NextFunction } from "express";
import { redis } from "../config";
import { logger } from "../utils";

// Create a custom rate limiter using Redis
export class RedisRateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private keyGenerator: (req: Request) => string;

  constructor(
    windowMs: number,
    maxRequests: number,
    keyGenerator?: (req: Request) => string
  ) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyGenerator = keyGenerator || ((req) => req.ip || "unknown");
  }

  async isAllowed(
    req: Request
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${this.keyGenerator(req)}`;
    const now = Date.now();
    const window = Math.floor(now / this.windowMs);
    const windowKey = `${key}:${window}`;

    try {
      const current = await redis.incr(windowKey);

      if (current === 1) {
        await redis.expire(windowKey, Math.ceil(this.windowMs / 1000));
      }

      const remaining = Math.max(0, this.maxRequests - current);
      const resetTime = (window + 1) * this.windowMs;

      return {
        allowed: current <= this.maxRequests,
        remaining,
        resetTime,
      };
    } catch (error) {
      logger.error("Rate limiter error:", error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
      };
    }
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const result = await this.isAllowed(req);

      res.set({
        "X-RateLimit-Limit": this.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
      });

      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          message: "Too many requests, please try again later",
          timestamp: new Date().toISOString(),
        });
      }

      return next();
    };
  }
}

// Default rate limiters
export const generalRateLimiter = new RedisRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const authRateLimiter = new RedisRateLimiter(15 * 60 * 1000, 10); // 10 auth requests per 15 minutes
export const uploadRateLimiter = new RedisRateLimiter(60 * 60 * 1000, 20); // 20 uploads per hour

// Express middleware
export const rateLimiterMiddleware = generalRateLimiter.middleware();
export const authRateLimiterMiddleware = authRateLimiter.middleware();
export const uploadRateLimiterMiddleware = uploadRateLimiter.middleware();

// ============================================================================
// 📁 src/utils/graphqlRedisRateLimiter.ts
// ============================================================================

import { redis } from "../config";
import { logger } from "../utils";
import { Context } from "../types";

// GraphQL-specific rate limiter using your existing Redis setup
export class GraphQLRedisRateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private keyGenerator: (ctx: Context, operationName?: string) => string;
  private name: string;

  constructor(
    name: string,
    windowMs: number,
    maxRequests: number,
    keyGenerator?: (ctx: Context, operationName?: string) => string
  ) {
    this.name = name;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyGenerator = keyGenerator || ((ctx, operation) => {
      const userId = ctx.user?.id || ctx.req!.ip || "unknown";
      return `${operation || 'unknown'}_${userId}`;
    });
  }

  async isAllowed(
    ctx: Context,
    operationName?: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; current: number }> {
    const key = `graphql_rate_limit:${this.name}:${this.keyGenerator(ctx, operationName)}`;
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
        current,
      };
    } catch (error) {
      logger.error(`GraphQL Rate limiter error for ${this.name}:`, error);
      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
        current: 0,
      };
    }
  }

  // Create TypeGraphQL middleware
  createMiddleware() {
    return async ({ context, info }: any, next: any) => {
      const operationName = info.fieldName;
      const result = await this.isAllowed(context, operationName);

      // Add rate limit headers to HTTP response (if available)
      if (context.res) {
        context.res.set({
          "X-RateLimit-Limit": this.maxRequests.toString(),
          "X-RateLimit-Remaining": result.remaining.toString(),
          "X-RateLimit-Reset": new Date(result.resetTime).toISOString(),
          "X-RateLimit-Window": `${this.windowMs}ms`,
        });
      }

      if (!result.allowed) {
        const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000);
        throw new Error(
          `Rate limit exceeded for ${this.name}. ${result.current}/${this.maxRequests} requests used. Try again in ${resetIn} seconds.`
        );
      }

      return next();
    };
  }
}
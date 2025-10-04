import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { ServiceResponse } from "../types";
import { logger } from "../utils";

// Cache TTL constants for consistency
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 900, // 15 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
} as const;

// Cache configuration
export const CACHE_CONFIG = {
  MAX_SIZE_KB: 1024, // 1MB max cache entry size
  BATCH_SIZE: 100, // Batch size for bulk operations
  KEY_SEPARATOR: ":",
} as const;

export abstract class BaseService {
  protected prisma: PrismaClient;
  protected redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  // Response helpers
  protected success<T>(
    data: T,
    message = "Operation successful"
  ): ServiceResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  protected failure<T = null>(
    message = "Operation failed",
    data: T | null = null,
    errors: any[] = []
  ): ServiceResponse<T> {
    return {
      success: false,
      message,
      data: data as T,
      errors,
    };
  }

  // Enhanced error handling with more comprehensive error mapping
  protected handleError(error: unknown, operation: string): ServiceResponse {
    const err = error as any; // Type assertion for error object

    logger.error(`Error in ${operation}:`, {
      message: err.message,
      code: err.code,
      name: err.name,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      operation,
      timestamp: new Date().toISOString(),
    });

    // Prisma specific errors
    switch (err.code) {
      case "P2002":
        return this.failure("Duplicate entry found", null, [
          {
            field: err.meta?.target,
            message: "This value already exists",
            code: "DUPLICATE_ENTRY",
          },
        ]);

      case "P2025":
        return this.failure("Record not found", null, [
          {
            message: "The requested resource does not exist",
            code: "NOT_FOUND",
          },
        ]);

      case "P2003":
        return this.failure("Foreign key constraint failed", null, [
          {
            field: err.meta?.field_name,
            message: "Referenced record does not exist",
            code: "FOREIGN_KEY_CONSTRAINT",
          },
        ]);

      case "P2014":
        return this.failure("Invalid relation", null, [
          {
            message: "The change would violate the required relation",
            code: "INVALID_RELATION",
          },
        ]);

      case "P2021":
        return this.failure("Table does not exist", null, [
          {
            message: "The table does not exist in the current database",
            code: "TABLE_NOT_EXISTS",
          },
        ]);
    }

    // Custom application errors
    if (err.name === "ValidationError") {
      return this.failure(
        "Validation failed",
        null,
        err.errors || [{ message: err.message, code: "VALIDATION_ERROR" }]
      );
    }

    if (err.name === "NotFoundError") {
      return this.failure("Resource not found", null, [
        { message: err.message, code: "NOT_FOUND" },
      ]);
    }

    if (err.name === "ForbiddenError") {
      return this.failure("Access denied", null, [
        { message: err.message, code: "FORBIDDEN" },
      ]);
    }

    if (err.name === "UnauthorizedError") {
      return this.failure("Authentication required", null, [
        { message: err.message, code: "UNAUTHORIZED" },
      ]);
    }

    // Network/Connection errors
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return this.failure("Service unavailable", null, [
        {
          message: "Unable to connect to required service",
          code: "SERVICE_UNAVAILABLE",
        },
      ]);
    }

    // Generic error fallback
    return this.failure(err.message || "An unexpected error occurred", null, [
      { message: err.message, code: "INTERNAL_ERROR" },
    ]);
  }

  // Enhanced cache key generation with type safety and sanitization
  protected generateCacheKey(
    prefix: string,
    ...identifiers: (string | number | boolean)[]
  ): string {
    const sanitizedIds = identifiers.map(
      (id) =>
        String(id)
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .substring(0, 100) // Limit identifier length
    );

    const key = `${prefix}${CACHE_CONFIG.KEY_SEPARATOR}${sanitizedIds.join(
      CACHE_CONFIG.KEY_SEPARATOR
    )}`;

    // Log if key is getting too long (Redis has 512MB key limit, but shorter is better)
    if (key.length > 250) {
      logger.warn(`Cache key might be too long: ${key.length} characters`);
    }

    return key;
  }

  // Enhanced cache setting with size limits and compression consideration
  protected async setCache(
    key: string,
    value: any,
    expiration = CACHE_TTL.LONG,
    options: {
      maxSizeKB?: number;
      compress?: boolean;
      skipSizeCheck?: boolean;
    } = {}
  ): Promise<boolean> {
    const {
      maxSizeKB = CACHE_CONFIG.MAX_SIZE_KB,
      compress = false,
      skipSizeCheck = false,
    } = options;

    try {
      let serialized = JSON.stringify(value);

      // Check size before caching
      if (!skipSizeCheck && serialized.length > maxSizeKB * 1024) {
        logger.warn(
          `Cache value too large for key ${key}: ${serialized.length} bytes, max: ${maxSizeKB}KB`
        );

        // Track cache rejections for monitoring
        await this.incrementCacheMetric("rejections", key);
        return false;
      }

      // Optional compression for large values (would need compression library)
      if (compress && serialized.length > 1024) {
        // Implementation would require zlib or similar
        logger.debug(`Compressing cache value for key ${key}`);
      }

      await this.redis.setex(key, expiration, serialized);
      await this.incrementCacheMetric("sets", key);

      return true;
    } catch (error: unknown) {
      const err = error as any;
      logger.warn(`Failed to set cache for key ${key}:`, {
        error: err.message,
        keyLength: key.length,
        valueSize: JSON.stringify(value).length,
      });

      await this.incrementCacheMetric("errors", key);
      return false;
    }
  }

  // Enhanced cache getting with metrics
  protected async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);

      if (cached) {
        await this.incrementCacheMetric("hits", key);
        return JSON.parse(cached);
      }

      await this.incrementCacheMetric("misses", key);
      return null;
    } catch (error: unknown) {
      const err = error as any;
      logger.warn(`Failed to get cache for key ${key}:`, {
        error: err.message,
      });

      await this.incrementCacheMetric("errors", key);
      return null;
    }
  }

  // Enhanced single key deletion
  protected async deleteCache(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      const deleted = result > 0;

      if (deleted) {
        await this.incrementCacheMetric("deletions", key);
      }

      return deleted;
    } catch (error: unknown) {
      const err = error as any;
      logger.warn(`Failed to delete cache for key ${key}:`, {
        error: err.message,
      });
      return false;
    }
  }

  // Enhanced pattern-based deletion with batching and progress tracking
  protected async deleteCachePattern(
    pattern: string,
    options: {
      batchSize?: number;
      logProgress?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<{ deleted: number; errors: number }> {
    const {
      batchSize = CACHE_CONFIG.BATCH_SIZE,
      logProgress = false,
      dryRun = false,
    } = options;

    let totalDeleted = 0;
    let totalErrors = 0;

    try {
      const keys = await this.redis.keys(pattern);

      if (keys.length === 0) {
        logger.debug(`No keys found matching pattern: ${pattern}`);
        return { deleted: 0, errors: 0 };
      }

      if (dryRun) {
        logger.info(
          `DRY RUN: Would delete ${keys.length} keys matching pattern: ${pattern}`
        );
        return { deleted: keys.length, errors: 0 };
      }

      // Process in batches to avoid blocking Redis
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);

        try {
          const deleted = await this.redis.del(...batch);
          totalDeleted += deleted;

          if (logProgress) {
            logger.debug(
              `Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
                keys.length / batchSize
              )}: ${deleted} keys`
            );
          }
        } catch (batchError: unknown) {
          const err = batchError as any;
          logger.error(`Failed to delete batch starting at index ${i}:`, err);
          totalErrors += batch.length;
        }
      }

      logger.info(
        `Cache pattern deletion completed: ${totalDeleted} deleted, ${totalErrors} errors for pattern: ${pattern}`
      );

      if (totalDeleted > 0) {
        await this.incrementCacheMetric("pattern_deletions", pattern);
      }
    } catch (error: unknown) {
      const err = error as any;
      logger.error(`Failed to delete cache pattern ${pattern}:`, err);
      totalErrors += 1;
    }

    return { deleted: totalDeleted, errors: totalErrors };
  }

  // Cache metrics tracking
  private async incrementCacheMetric(
    metric:
      | "hits"
      | "misses"
      | "sets"
      | "deletions"
      | "rejections"
      | "errors"
      | "pattern_deletions",
    key?: string
  ): Promise<void> {
    try {
      const metricKey = `cache_metrics:${metric}`;
      await this.redis.incr(metricKey);

      // Optional: Track per-prefix metrics
      if (key) {
        const prefix = key.split(CACHE_CONFIG.KEY_SEPARATOR)[0];
        const prefixMetricKey = `cache_metrics:${metric}:${prefix}`;
        await this.redis.incr(prefixMetricKey);
      }

      // Set expiration for metrics (rolling 24 hour window)
      await this.redis.expire(metricKey, CACHE_TTL.VERY_LONG);
    } catch (error: unknown) {
      // Don't log errors for metrics to avoid log spam
    }
  }

  // Get cache metrics for monitoring
  protected async getCacheMetrics(): Promise<{
    hits: number;
    misses: number;
    sets: number;
    deletions: number;
    rejections: number;
    errors: number;
    hitRate: number;
  }> {
    try {
      const [hits, misses, sets, deletions, rejections, errors] =
        await Promise.all([
          this.redis.get("cache_metrics:hits").then((v) => parseInt(v || "0")),
          this.redis
            .get("cache_metrics:misses")
            .then((v) => parseInt(v || "0")),
          this.redis.get("cache_metrics:sets").then((v) => parseInt(v || "0")),
          this.redis
            .get("cache_metrics:deletions")
            .then((v) => parseInt(v || "0")),
          this.redis
            .get("cache_metrics:rejections")
            .then((v) => parseInt(v || "0")),
          this.redis
            .get("cache_metrics:errors")
            .then((v) => parseInt(v || "0")),
        ]);

      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;

      return {
        hits,
        misses,
        sets,
        deletions,
        rejections,
        errors,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error: unknown) {
      const err = error as any;
      logger.warn("Failed to get cache metrics:", err);
      return {
        hits: 0,
        misses: 0,
        sets: 0,
        deletions: 0,
        rejections: 0,
        errors: 0,
        hitRate: 0,
      };
    }
  }

  // Enhanced pagination with better validation and metadata
  protected buildPagination(
    page: number,
    limit: number,
    totalItems: number,
    options: {
      maxLimit?: number;
      includeUrls?: boolean;
      baseUrl?: string;
    } = {}
  ) {
    const { maxLimit = 100, includeUrls = false, baseUrl = "" } = options;

    const validatedLimit = Math.min(maxLimit, Math.max(1, limit));
    const validatedPage = Math.max(1, page);
    const totalPages = Math.ceil(totalItems / validatedLimit);
    const skip = (validatedPage - 1) * validatedLimit;

    const pagination = {
      page: validatedPage,
      limit: validatedLimit,
      totalPages,
      totalItems,
      hasNextPage: validatedPage < totalPages,
      hasPreviousPage: validatedPage > 1,
      skip,
      // Additional metadata
      startItem: skip + 1,
      endItem: Math.min(skip + validatedLimit, totalItems),
      isFirstPage: validatedPage === 1,
      isLastPage: validatedPage === totalPages,
    };

    // Optional URL generation for API responses
    if (includeUrls && baseUrl) {
      return {
        ...pagination,
        urls: {
          first: `${baseUrl}?page=1&limit=${validatedLimit}`,
          last: `${baseUrl}?page=${totalPages}&limit=${validatedLimit}`,
          next: pagination.hasNextPage
            ? `${baseUrl}?page=${validatedPage + 1}&limit=${validatedLimit}`
            : null,
          previous: pagination.hasPreviousPage
            ? `${baseUrl}?page=${validatedPage - 1}&limit=${validatedLimit}`
            : null,
        },
      };
    }

    return pagination;
  }

  // Enhanced pagination validation with more comprehensive checks
  protected validatePagination(
    page?: number,
    limit?: number,
    options: {
      maxLimit?: number;
      defaultLimit?: number;
      allowZeroPage?: boolean;
    } = {}
  ) {
    const {
      maxLimit = 100,
      defaultLimit = 10,
      allowZeroPage = false,
    } = options;

    // Validate and sanitize page
    let validatedPage = parseInt(String(page || 1));
    if (isNaN(validatedPage) || validatedPage < (allowZeroPage ? 0 : 1)) {
      validatedPage = 1;
    }

    // Validate and sanitize limit
    let validatedLimit = parseInt(String(limit || defaultLimit));
    if (isNaN(validatedLimit) || validatedLimit < 1) {
      validatedLimit = defaultLimit;
    }
    validatedLimit = Math.min(maxLimit, validatedLimit);

    const skip = Math.max(0, (validatedPage - 1) * validatedLimit);

    return {
      page: validatedPage,
      limit: validatedLimit,
      skip,
      // Additional validation info
      wasPageCorrected: validatedPage !== page,
      wasLimitCorrected: validatedLimit !== limit,
      maxLimit,
      defaultLimit,
    };
  }

  // Utility method for cache warming
  protected async warmCache(
    cacheWarming: Array<{
      key: string;
      dataFetcher: () => Promise<any>;
      ttl?: number;
    }>
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    await Promise.allSettled(
      cacheWarming.map(async ({ key, dataFetcher, ttl = CACHE_TTL.LONG }) => {
        try {
          const data = await dataFetcher();
          const cached = await this.setCache(key, data, ttl as any);
          if (cached) {
            successful++;
          } else {
            failed++;
          }
        } catch (error: unknown) {
          const err = error as any;
          logger.warn(`Failed to warm cache for key ${key}:`, err);
          failed++;
        }
      })
    );

    // logger.info(
    //   `Cache warming completed: ${successful} successful, ${failed} failed`
    // );
    return { successful, failed };
  }
}

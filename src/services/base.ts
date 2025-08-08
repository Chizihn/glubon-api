import type { PrismaClient } from "@prisma/client";
import type { Redis } from "ioredis";
import { ServiceResponse } from "../types";
import { logger } from "../utils";

export abstract class BaseService {
  protected prisma: PrismaClient;
  protected redis: Redis;

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

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

  protected failure<T>(
    message = "Operation failed",
    data: T | null = null,
    errors: any[] = []
  ): ServiceResponse {
    return {
      success: false,
      message,
      data,
      errors,
    };
  }

  protected handleError(error: any, operation: string): ServiceResponse {
    logger.error(`Error in ${operation}:`, error);

    if (error.code === "P2002") {
      return this.failure("Duplicate entry found", [error.message]);
    }

    if (error.code === "P2025") {
      return this.failure("Record not found", [error.message]);
    }

    if (error.name === "ValidationError") {
      return this.failure("Validation failed", error.errors);
    }

    return this.failure(error.message || "An unexpected error occurred", [
      error.message,
    ]);
  }

  protected generateCacheKey(prefix: string, ...identifiers: string[]): string {
    return `${prefix}:${identifiers.join(":")}`;
  }

  protected async setCache(
    key: string,
    value: any,
    expiration = 3600
  ): Promise<void> {
    try {
      await this.redis.setex(key, expiration, JSON.stringify(value));
    } catch (error) {
      logger.warn(`Failed to set cache for key ${key}:`, error);
    }
  }

  protected async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  protected async deleteCache(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.warn(`Failed to delete cache for key ${key}:`, error);
    }
  }

  protected async deleteCachePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.warn(`Failed to delete cache pattern ${pattern}:`, error);
    }
  }

  protected buildPagination(page: number, limit: number, totalItems: number) {
    const totalPages = Math.ceil(totalItems / limit);
    return {
      page,
      limit,
      totalPages,
      totalItems,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      skip: (page - 1) * limit,
    };
  }

  protected validatePagination(page?: number, limit?: number) {
    const validatedPage = Math.max(1, page || 1);
    const validatedLimit = Math.min(100, Math.max(1, limit || 10));
    return {
      page: validatedPage,
      limit: validatedLimit,
      skip: (validatedPage - 1) * validatedLimit,
    };
  }
}

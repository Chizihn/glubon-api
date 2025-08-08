import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { logger } from "../utils";

export abstract class BaseRepository {
  constructor(protected prisma: PrismaClient, protected redis: Redis) {}

  protected async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.warn(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  protected async setCache<T>(
    key: string,
    value: T,
    ttl: number
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttl);
    } catch (error) {
      logger.warn(`Failed to set cache for key ${key}:`, error);
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

  protected generateCacheKey(...parts: string[]): string {
    return parts.join(":");
  }

  protected validatePagination(
    page: number,
    limit: number
  ): { skip: number; limit: number } {
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    return {
      skip: (validatedPage - 1) * validatedLimit,
      limit: validatedLimit,
    };
  }

  public buildPagination(page: number, limit: number, totalCount: number) {
    const totalPages = Math.ceil(totalCount / limit);
    return {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

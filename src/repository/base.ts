import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { logger } from "../utils";
import { Decimal } from "@prisma/client/runtime/library";
import { Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

export abstract class BaseRepository {
  constructor(
    @Inject(PRISMA_TOKEN) protected prisma: PrismaClient,
    @Inject(REDIS_TOKEN) protected redis: Redis
  ) {}

  protected async getCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      
      // Parse the JSON and convert string numbers back to Decimal
      const parsed = JSON.parse(cached, (key, value) => {
        // Handle Decimal values that were stringified
        if (value && typeof value === 'object' && value.type === 'Decimal' && 'value' in value) {
          return new Decimal(value.value);
        }
        return value;
      });
      
      // Convert any string numbers in nested objects to Decimal
      return this.convertToDecimals(parsed) as T;
    } catch (error) {
      logger.warn(`Failed to get cache for key ${key}:`, error);
      return null;
    }
  }

  private convertToDecimals(value: any): any {
    if (value === null || value === undefined) return value;
    
    if (Array.isArray(value)) {
      return value.map(item => this.convertToDecimals(item));
    }
    
    if (typeof value === 'object') {
      // Check if it's a Decimal-like object from Prisma
      if (value.isDecimal && typeof value.toFixed === 'function') {
        return new Decimal(value.toString());
      }
      
      // Process all properties of the object
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = this.convertToDecimals(v);
      }
      return result;
    }
    
    // Convert string numbers to Decimal
    if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
      return new Decimal(value);
    }
    
    return value;
  }

  protected async setCache<T>(
    key: string,
    value: T,
    ttl: number
  ): Promise<void> {
    try {
      // Convert Decimal instances to a serializable format
      const serializableValue = JSON.stringify(value, (key, value) => {
        if (value && typeof value === 'object' && 'toFixed' in value) {
          // Handle Decimal instances
          return { type: 'Decimal', value: value.toString() };
        }
        return value;
      });
      
      await this.redis.set(key, serializableValue, "EX", ttl);
    } catch (error) {
      logger.warn(`Failed to set cache for key ${key}:`, error);
    }
  }

  /**
   * Scan Redis keys matching a pattern (non-blocking alternative to KEYS)
   */
  protected async scanKeys(pattern: string, count = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    try {
      do {
        const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
        cursor = result[0];
        const batch = result[1];
        
        if (batch.length > 0) {
          keys.push(...batch);
        }
      } while (cursor !== '0');

      return keys;
    } catch (error) {
      logger.warn(`Failed to scan keys for pattern ${pattern}:`, error);
      return keys;
    }
  }

  protected async deleteCachePattern(pattern: string): Promise<void> {
    try {
      // Use SCAN instead of KEYS to avoid blocking Redis
      const keys = await this.scanKeys(pattern);
      if (keys.length > 0) {
        // Delete in batches to avoid overwhelming Redis
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.redis.del(...batch);
        }
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

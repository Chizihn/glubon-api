import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

/**
 * A simple dependency injection container
 */
let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    throw new Error('Container has not been initialized. Call initContainer first.');
  }
  return containerInstance;
}

export function initContainer(prisma: PrismaClient, redis: Redis): Container {
  if (!containerInstance) {
    containerInstance = Container.getInstance(prisma, redis);
  }
  return containerInstance;
}

export class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();
  private prisma: PrismaClient;
  private redis: Redis;

  private constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Get the singleton instance of the container
   */
  public static getInstance(prisma?: PrismaClient, redis?: Redis): Container {
    if (!Container.instance && prisma && redis) {
      Container.instance = new Container(prisma, redis);
    } else if (!Container.instance) {
      throw new Error('Container not initialized. Please provide prisma and redis instances on first call.');
    }
    return Container.instance;
  }

  /**
   * Register a service in the container
   */
  public register<T>(key: string, factory: (container: Container) => T): void {
    this.services.set(key, factory);
  }

  /**
   * Resolve a service from the container
   */
  public resolve<T>(key: string): T {
    if (!this.services.has(key)) {
      throw new Error(`Service '${key}' not found in container`);
    }

    // If the service is a factory function, execute it and cache the result
    if (typeof this.services.get(key) === 'function') {
      const factory = this.services.get(key);
      const service = factory(this);
      this.services.set(key, service);
      return service;
    }

    return this.services.get(key);
  }

  /**
   * Get Prisma instance
   */
  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * Get Redis instance
   */
  public getRedis(): Redis {
    return this.redis;
  }

  /**
   * Clear all services (useful for testing)
   */
  public clear(): void {
    this.services.clear();
  }
}

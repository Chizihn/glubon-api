import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { BaseService } from './base';
import { pubSub, SUBSCRIPTION_EVENTS } from '../utils/pubsub';

type PrismaError = Error & {
  code?: string;
  meta?: {
    target?: string[];
    field_name?: string;
  };
};

type UserPresence = {
  id: string;
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
  socketId: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export class PresenceService extends BaseService {
  private readonly ONLINE_USERS_KEY = 'online_users';
  private readonly PRESENCE_TTL = 60 * 5; // 5 minutes

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.redis = redis;
  }

  async userConnected(userId: string, socketId: string) {
    const now = new Date();
    
    // Update Redis set with user ID
    await this.redis.sadd(this.ONLINE_USERS_KEY, userId);
    await this.redis.expire(this.ONLINE_USERS_KEY, this.PRESENCE_TTL);

    // Update database
    await (this.prisma as any).userPresence.upsert({
      where: { userId },
      update: { 
        isOnline: true,
        lastSeen: now,
        socketId
      },
      create: {
        userId,
        isOnline: true,
        lastSeen: now,
        socketId
      },
    });

    // Log presence in history
    await (this.prisma as any).userPresenceHistory.create({
      data: {
        userId,
        status: 'online',
      },
    });

    // Publish presence update
    const pubSubTyped = pubSub as unknown as {
      publish: (trigger: string, payload: any) => Promise<void>;
    };
    
    await pubSubTyped.publish(SUBSCRIPTION_EVENTS.PRESENCE_CHANGED, {
      presenceChanged: {
        userId,
        isOnline: true,
        lastSeen: now,
      },
    });
  }

  async userDisconnected(userId: string) {
    const now = new Date();
    
    // Remove from Redis set
    await this.redis.srem(this.ONLINE_USERS_KEY, userId);

    try {
      // Try to update existing record
      await (this.prisma as any).userPresence.update({
        where: { userId },
        data: { 
          isOnline: false,
          lastSeen: now,
          socketId: null
        },
      });
    } catch (error: unknown) {
      const prismaError = error as PrismaError;
      // If record doesn't exist, create it
      if (prismaError.code === 'P2025') {
        await (this.prisma as any).userPresence.create({
          data: {
            userId,
            isOnline: false,
            lastSeen: now,
            socketId: null
          },
        });
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Log presence in history
    await this.prisma.userPresenceHistory.create({
      data: {
        userId,
        status: 'offline',
      },
    });

    // Publish presence update
    const pubSubTyped = pubSub as unknown as {
      publish: (trigger: string, payload: any) => Promise<void>;
    };
    
    await pubSubTyped.publish(SUBSCRIPTION_EVENTS.PRESENCE_CHANGED, {
      presenceChanged: {
        userId,
        isOnline: false,
        lastSeen: now,
      },
    });
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    // Check Redis first
    const isOnline = await this.redis.sismember(this.ONLINE_USERS_KEY, userId);
    
    const presence = await (this.prisma as any).userPresence.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!presence) return null;

    return {
      ...presence,
      isOnline: isOnline === 1,
    };
  }

  async getBatchUserPresence(userIds: string[]): Promise<UserPresence[]> {
    // Check Redis for online users
    const onlineStatuses = await Promise.all(
      userIds.map(id => this.redis.sismember(this.ONLINE_USERS_KEY, id))
    );

    // Get all presences from database
    const presences = await (this.prisma as any).userPresence.findMany({
      where: { userId: { in: userIds } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create a map of user ID to online status
    const onlineStatusMap = new Map<string, boolean>();
    userIds.forEach((userId, index) => {
      onlineStatusMap.set(userId, onlineStatuses[index] === 1);
    });

    // Merge online status from Redis
    return presences.map((presence: any) => ({
      ...presence,
      isOnline: onlineStatusMap.get(presence.userId) || false,
    }));
  }

  async cleanupStaleConnections(): Promise<void> {
    // Get all users marked as online in the database but not in Redis
    const staleConnections = await (this.prisma as any).userPresence.findMany({
      where: {
        isOnline: true,
        lastSeen: {
          lt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
        },
      },
    });

    // Mark them as offline
    for (const connection of staleConnections) {
      await this.userDisconnected(connection.userId);
    }
  }
}

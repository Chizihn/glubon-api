import { PrismaClient, NotificationType, RoleEnum } from "@prisma/client";
import { Redis } from "ioredis";
import { logger } from "../utils";
import { NotificationFilters } from "../types/services/notification";
import { BaseRepository } from "./base";

export class NotificationRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async createNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    data?: any;
  }): Promise<any> {
    const cacheKey = this.generateCacheKey("notification", data.userId, "list");
    
    // Ensure data is properly serialized
    const notificationData = {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      data: data.data ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : {},
    };
    
    const notification = await this.prisma.notification.create({
      data: notificationData,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.deleteCachePattern(cacheKey);
    return notification;
  }

  async createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    data?: any
  ): Promise<{ count: number }> {
    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        title,
        message,
        type,
        data: data || {},
      })),
    });

    for (const userId of userIds) {
      await this.deleteCachePattern(
        this.generateCacheKey("notification", userId, "list")
      );
    }
    return { count: result.count };
  }

  async getUserNotifications(filters: NotificationFilters): Promise<{
    notifications: any[];
    totalCount: number;
    unreadCount: number;
  }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );

    const cacheKey = this.generateCacheKey(
      "notification",
      filters.userId,
      "list",
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );

    // Temporarily disable cache for debugging
    // const cached = await this.getCache<{
    //   notifications: any[];
    //   totalCount: number;
    //   unreadCount: number;
    // }>(cacheKey);
    // if (cached) {
    //   console.log('Returning cached result');
    //   return cached;
    // }

    const where: any = { 
      userId: filters.userId  
    };
    if (filters.type) where.type = filters.type;
    if (filters.isRead !== undefined) where.isRead = filters.isRead;

    const [notifications, totalCount, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },  
      }),
    ]);

    const result = { 
      notifications, 
      totalCount, 
      unreadCount 
    };

    // Temporarily disable cache
    // await this.setCache(cacheKey, result, 300);

    return result;
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return false;

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    await this.deleteCachePattern(
      this.generateCacheKey("notification", userId, "list")
    );
    return true;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    await this.deleteCachePattern(
      this.generateCacheKey("notification", userId, "list")
    );
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) return false;

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    await this.deleteCachePattern(
      this.generateCacheKey("notification", userId, "list")
    );
    return true;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cacheKey = this.generateCacheKey("notification", userId, "unread");
    const cached = await this.getCache<number>(cacheKey);
    if (cached !== null) return cached;

    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    await this.setCache(cacheKey, count, 300);
    return count;
  }

  async getPropertyDetailsForNotification(
    propertyId: string
  ): Promise<{
    ownerId: string;
    title: string;
    likes: number;
    views: number;
  } | null> {
    const cacheKey = this.generateCacheKey(
      "notification",
      "property",
      propertyId
    );
    const cached = await this.getCache<{
      ownerId: string;
      title: string;
      likes: number;
      views: number;
    }>(cacheKey);
    if (cached) return cached;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        owner: { select: { id: true } },
        _count: { select: { likes: true, views: true } },
      },
    });

    if (!property) return null;

    const result = {
      ownerId: property.ownerId,
      title: property.title,
      likes: property._count.likes,
      views: property._count.views,
    };

    await this.setCache(cacheKey, result, 600);
    return result;
  }

  async getUserDetailsForNotification(
    userId: string
  ): Promise<{ firstName: string; lastName: string } | null> {
    const cacheKey = this.generateCacheKey("notification", "user", userId);
    const cached = await this.getCache<{ firstName: string; lastName: string }>(
      cacheKey
    );
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    if (!user) return null;

    await this.setCache(cacheKey, user, 600);
    return user;
  }

  async getUsersByRole(role: RoleEnum): Promise<string[]> {
    const cacheKey = this.generateCacheKey("notification", "role", role);
    const cached = await this.getCache<string[]>(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: { role },
      select: { id: true },
    });

    const userIds = users.map((user) => user.id);
    await this.setCache(cacheKey, userIds, 300);
    return userIds;
  }
}

// src/services/notification.ts
import { PrismaClient, NotificationType, RoleEnum } from "@prisma/client";
import { Redis } from "ioredis";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { BaseService } from "./base";
import { EmailService } from "./email";
import {
  CreateNotificationData,
  NotificationFilters,
  NotificationResponseData,
  EmailNotificationType,
} from "../types/services/notification";
import { logger, pubSub } from "../utils";
import { NotificationRepository } from "../repository/notification";

export class NotificationService extends BaseService {
  private emailService: EmailService;
  private repository: NotificationRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.emailService = new EmailService(prisma, redis);
    this.repository = new NotificationRepository(prisma, redis);
  }

  async createNotification(data: CreateNotificationData): Promise<any> {
    try {
      const notification = await this.repository.createNotification(data);

      // Explicitly type pubSub as RedisPubSub to avoid union type issues
      await (pubSub as RedisPubSub).publish("NOTIFICATION_CREATED", {
        notificationCreated: notification,
        userId: data.userId,
      });

      if (this.shouldSendEmail(data.type)) {
        await this.emailService.sendNotificationEmail(
          notification.user.email,
          notification.user.firstName,
          data.title,
          data.message,
          data.type as EmailNotificationType
        );
      }

      return this.success(notification, "Notification created successfully");
    } catch (error: unknown) {
      return this.failure("Failed to create notification", [
        (error as Error).message,
      ]);
    }
  }

  async getUserNotifications(filters: NotificationFilters): Promise<any> {
    try {
      const { notifications, totalCount, unreadCount } =
        await this.repository.getUserNotifications(filters);
      const pagination = this.repository.buildPagination(
        filters.page || 1,
        filters.limit || 20,
        totalCount
      );
      return this.success(
        { notifications, pagination, unreadCount },
        "Notifications retrieved successfully"
      );
    } catch (error: unknown) {
      return this.failure("Failed to retrieve notifications", [
        (error as Error).message,
      ]);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<any> {
    try {
      const success = await this.repository.markAsRead(notificationId, userId);
      if (!success) return this.failure("Notification not found");
      return this.success(null, "Notification marked as read");
    } catch (error: unknown) {
      return this.failure("Failed to mark notification as read", [
        (error as Error).message,
      ]);
    }
  }

  async markAllAsRead(userId: string): Promise<any> {
    try {
      await this.repository.markAllAsRead(userId);
      return this.success(null, "All notifications marked as read");
    } catch (error: unknown) {
      return this.failure("Failed to mark all notifications as read", [
        (error as Error).message,
      ]);
    }
  }

  async deleteNotification(
    notificationId: string,
    userId: string
  ): Promise<any> {
    try {
      const success = await this.repository.deleteNotification(
        notificationId,
        userId
      );
      if (!success) return this.failure("Notification not found");
      return this.success(null, "Notification deleted successfully");
    } catch (error: unknown) {
      return this.failure("Failed to delete notification", [
        (error as Error).message,
      ]);
    }
  }

  async getUnreadCount(userId: string): Promise<any> {
    try {
      const count = await this.repository.getUnreadCount(userId);
      return this.success({ count }, "Unread count retrieved successfully");
    } catch (error: unknown) {
      return this.failure("Failed to get unread count", [
        (error as Error).message,
      ]);
    }
  }

  async sendBulkNotification(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType,
    data?: any
  ): Promise<any> {
    try {
      const result = await this.repository.createBulkNotifications(
        userIds,
        title,
        message,
        type,
        data
      );

      for (const userId of userIds) {
        await (pubSub as RedisPubSub).publish("NOTIFICATION_CREATED", {
          notificationCreated: { title, message, type, data },
          userId,
        });
      }

      return this.success(
        { count: result.count },
        "Bulk notifications sent successfully"
      );
    } catch (error: unknown) {
      return this.failure("Failed to send bulk notifications", [
        (error as Error).message,
      ]);
    }
  }

  async sendNotificationToRole(
    role: RoleEnum,
    title: string,
    message: string,
    type: NotificationType,
    data?: any
  ): Promise<any> {
    try {
      const userIds = await this.repository.getUsersByRole(role);
      return await this.sendBulkNotification(
        userIds,
        title,
        message,
        type,
        data
      );
    } catch (error: unknown) {
      return this.failure("Failed to send notifications to role", [
        (error as Error).message,
      ]);
    }
  }

  async notifyPropertyLiked(
    propertyId: string,
    likerId: string
  ): Promise<void> {
    try {
      const property = await this.repository.getPropertyDetailsForNotification(
        propertyId
      );
      if (!property) return;

      const liker = await this.repository.getUserDetailsForNotification(
        likerId
      );
      if (!liker) return;

      await this.createNotification({
        userId: property.ownerId,
        title: "Property Liked",
        message: `${liker.firstName} ${liker.lastName} liked your property "${property.title}"`,
        type: NotificationType.PROPERTY_LIKED,
        data: {
          propertyId,
          likerId,
          totalLikes: property.likes,
        },
      });
    } catch (error: unknown) {
      logger.error(
        "Failed to send property liked notification:",
        error as Error
      );
    }
  }

  async notifyPropertyViewed(
    propertyId: string,
    viewerId: string
  ): Promise<void> {
    try {
      const property = await this.repository.getPropertyDetailsForNotification(
        propertyId
      );
      if (!property) return;

      const viewer = await this.repository.getUserDetailsForNotification(
        viewerId
      );
      if (!viewer) return;

      await this.createNotification({
        userId: property.ownerId,
        title: "Property Viewed",
        message: `${viewer.firstName} ${viewer.lastName} viewed your property "${property.title}"`,
        type: NotificationType.PROPERTY_VIEWED,
        data: {
          propertyId,
          viewerId,
          totalViews: property.views,
        },
      });
    } catch (error: unknown) {
      logger.error(
        "Failed to send property viewed notification:",
        error as Error
      );
    }
  }

  async notifyPropertyInquiry(
    propertyId: string,
    inquirerId: string,
    message: string
  ): Promise<void> {
    try {
      const property = await this.repository.getPropertyDetailsForNotification(
        propertyId
      );
      if (!property) return;

      const inquirer = await this.repository.getUserDetailsForNotification(
        inquirerId
      );
      if (!inquirer) return;

      await this.createNotification({
        userId: property.ownerId,
        title: "New Property Inquiry",
        message: `${inquirer.firstName} ${inquirer.lastName} sent an inquiry about "${property.title}"`,
        type: NotificationType.PROPERTY_INQUIRY,
        data: {
          propertyId,
          inquirerId,
          inquiryMessage: message,
        },
      });
    } catch (error: unknown) {
      logger.error(
        "Failed to send property inquiry notification:",
        error as Error
      );
    }
  }

  private shouldSendEmail(type: NotificationType): boolean {
    const emailTypes: EmailNotificationType[] = [
      NotificationType.PROPERTY_APPROVED,
      NotificationType.PROPERTY_REJECTED,
      NotificationType.VERIFICATION_APPROVED,
      NotificationType.VERIFICATION_REJECTED,
      NotificationType.ACCOUNT_SUSPENDED,
      NotificationType.ACCOUNT_REACTIVATED,
    ];
    return emailTypes.includes(type as EmailNotificationType);
  }
}

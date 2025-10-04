import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Arg,
  Ctx,
  UseMiddleware,
  Int,
  Root,
} from "type-graphql";
import type { Context } from "../../types/context";
import { AuthMiddleware } from "../../middleware/auth";
import { BaseResponse } from "../../types/responses";
import { logger, SUBSCRIPTION_EVENTS } from "../../utils";
import { getContainer } from "../../services";
import {
  BulkNotificationResponse,
  NotificationCreatedPayload,
  NotificationResponse,
  NotificationStatsResponse,
  PaginatedNotificationsResponse,
} from "./notification.types";
import {
  BulkNotificationInput,
  CreateNotificationInput,
  NotificationFilters,
} from "./notification.inputs";
import { NotificationService } from "../../services/notification";
import { NotificationType, RoleEnum } from "@prisma/client";

@Resolver()
export class NotificationResolver {
  private notificationService: NotificationService;

  constructor() {
        const container = getContainer();
    
    this.notificationService = container.resolve('notificationService');
  }

  @Query(() => PaginatedNotificationsResponse)
  @UseMiddleware(AuthMiddleware)
  async getNotifications(
    @Arg("filters", { nullable: true }) filters: NotificationFilters = {},
    @Arg("page", () => Int, { defaultValue: 1 }) page: number = 1,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number = 20,
    @Ctx() ctx: Context
  ): Promise<PaginatedNotificationsResponse> {
    try {
      // Validate pagination parameters
      const validatedPage = Math.max(1, Number(page) || 1);
      const validatedLimit = Math.min(Math.max(1, Number(limit) || 20), 100); // Limit to max 100 items per page

      const result = await this.notificationService.getUserNotifications({
        userId: ctx.user!.id,
        ...filters,
        page: validatedPage,
        limit: validatedLimit,
      });

      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch notifications');
      }

      // Get the actual counts from the result
      const currentPage = Math.max(1, Number(page) || 1);
      const perPage = Math.max(1, Math.min(Number(limit) || 20, 100));
      const totalItems = result.data.totalCount || 0;
      const totalPages = Math.ceil(totalItems / perPage);
      
      // Ensure currentPage is within valid range
      const validPage = Math.min(currentPage, Math.max(1, totalPages || 1));
      
      // If we're on a page that's now empty (e.g., after deletions), go to the last valid page
      if (currentPage > 1 && totalItems > 0 && validPage !== currentPage) {
      }

      // If we're on an invalid page, refetch with the last valid page
      if (validPage !== currentPage) {
        const refetchResult = await this.notificationService.getUserNotifications({
          userId: ctx.user!.id,
          ...filters,
          page: validPage,
          limit: perPage,
        });
        
        if (refetchResult.success) {
          return new PaginatedNotificationsResponse(
            refetchResult.data.notifications || [],
            validPage,
            perPage,
            refetchResult.data.totalCount || 0,
            Number(refetchResult.data.unreadCount) || 0
          );
        }
      }
      
      // Otherwise return the current results
      const response = new PaginatedNotificationsResponse(
        result.data.notifications || [],
        validPage,
        perPage,
        totalItems,
        Number(result.data.unreadCount) || 0
      );


      return response;
    } catch (error) {
      logger.error('Error in getNotifications:', error);
      // Return an empty response with zero counts to prevent GraphQL errors
      return new PaginatedNotificationsResponse([], 1, 20, 0);
    }
  }

  @Query(() => NotificationStatsResponse)
  @UseMiddleware(AuthMiddleware)
  async getNotificationStats(
    @Ctx() ctx: Context
  ): Promise<NotificationStatsResponse> {
    const result = await this.notificationService.getUnreadCount(ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return { unreadCount: result.data.count };
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async markNotificationAsRead(
    @Arg("notificationId") notificationId: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.notificationService.markAsRead(
      notificationId,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async markAllNotificationsAsRead(@Ctx() ctx: Context): Promise<BaseResponse> {
    const result = await this.notificationService.markAllAsRead(ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async deleteNotification(
    @Arg("notificationId") notificationId: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.notificationService.deleteNotification(
      notificationId,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => NotificationResponse)
  @UseMiddleware(AuthMiddleware)
  async createNotification(
    @Arg("input") input: CreateNotificationInput,
    @Ctx() ctx: Context
  ): Promise<NotificationResponse> {
    const data = input.data ? JSON.parse(input.data) : undefined;
    const result = await this.notificationService.createNotification({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type,
      data,
    });

    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => BulkNotificationResponse)
  @UseMiddleware(AuthMiddleware)
  async sendBulkNotification(
    @Arg("input") input: BulkNotificationInput,
    @Ctx() ctx: Context
  ): Promise<BulkNotificationResponse> {
    const data = input.data ? JSON.parse(input.data) : undefined;
    const result = await this.notificationService.sendBulkNotification(
      input.userIds,
      input.title,
      input.message,
      input.type,
      data
    );

    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => BulkNotificationResponse)
  @UseMiddleware(AuthMiddleware)
  async sendNotificationToRole(
    @Arg("role", () => RoleEnum) role: RoleEnum,
    @Arg("title") title: string,
    @Arg("message") message: string,
    @Arg("type", () => NotificationType) type: NotificationType,
    @Arg("data", { nullable: true }) data?: string
  ): Promise<BulkNotificationResponse> {
    const parsedData = data ? JSON.parse(data) : undefined;
    const result = await this.notificationService.sendNotificationToRole(
      role,
      title,
      message,
      type,
      parsedData
    );

    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Subscription(() => NotificationResponse, {
    topics: SUBSCRIPTION_EVENTS.NOTIFICATION_CREATED,
    filter: ({
      payload,
      context,
    }: {
      payload: NotificationCreatedPayload;
      context: Context;
    }) => {
      return payload.userId === context.user?.id;
    },
  })
  async notificationCreated(
    @Root() payload: NotificationCreatedPayload
  ): Promise<NotificationResponse> {
    return payload.notification;
  }
}

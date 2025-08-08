import {
  PrismaClient,
  MessageType,
  NotificationType,
  RoleEnum,
  Prisma,
} from "@prisma/client";
import Redis from "ioredis";
import { IBaseResponse } from "../types/responses";
import { pubSub, SUBSCRIPTION_EVENTS } from "../utils/pubsub";
import { StatusCodes } from "http-status-codes";
import { BaseService } from "./base";
import { NotificationService } from "./notification";
import { EmailService } from "./email";
import {
  ConversationFilters,
  CreateConversationInput,
  MessageFilters,
  SendMessageInput,
} from "../types/services/chat";
import { RedisPubSub } from "graphql-redis-subscriptions";

export class ChatService extends BaseService {
  private notificationService: NotificationService;
  private emailService: EmailService;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.emailService = new EmailService(prisma, redis);
  }

  async createConversation(
    input: CreateConversationInput
  ): Promise<IBaseResponse<any>> {
    try {
      const { propertyId, renterId, ownerId } = input;

      // Verify property exists and belongs to owner
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
        include: { owner: true },
      });

      if (!property) {
        return this.failure("Property not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Verify renter exists and is a tenant
      const renter = await this.prisma.user.findFirst({
        where: { id: renterId, role: RoleEnum.TENANT, isActive: true },
      });

      if (!renter) {
        return this.failure("Renter not found or invalid", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Check if conversation already exists
      const existingConversation = await this.prisma.conversation.findFirst({
        where: { propertyId, renterId, ownerId },
      });

      if (existingConversation) {
        return this.success(
          existingConversation,
          "Conversation already exists"
        );
      }

      // Create new conversation
      const conversation = await this.prisma.conversation.create({
        data: { propertyId, renterId, ownerId },
        include: {
          property: {
            select: { id: true, title: true, images: true },
          },
          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          _count: { select: { messages: true } },
        },
      });

      // Clear cache
      await Promise.all([
        this.deleteCachePattern(`conversations:${renterId}:*`),
        this.deleteCachePattern(`conversations:${ownerId}:*`),
      ]);

      return this.success(conversation, "Conversation created successfully");
    } catch (error: unknown) {
      return this.handleError(error, "createConversation");
    }
  }

  async getConversations(
    filters: ConversationFilters & { userId: string },
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{
      conversations: any[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { userId, isActive, propertyId, search } = filters;
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      const cacheKey = this.generateCacheKey(
        "conversations",
        userId,
        JSON.stringify({ isActive, propertyId, search }),
        page.toString()
      );

      // Try cache first
      const cached = await this.getCache<any>(cacheKey);
      if (cached) {
        return this.success(cached, "Conversations retrieved from cache");
      }

      // Build where clause
      const where: any = {
        OR: [{ renterId: userId }, { ownerId: userId }],
      };

      if (isActive !== undefined) where.isActive = isActive;
      if (propertyId) where.propertyId = propertyId;

      if (search) {
        where.property = {
          title: { contains: search, mode: "insensitive" },
        };
      }

      const [conversations, totalCount] = await Promise.all([
        this.prisma.conversation.findMany({
          where,
          include: {
            property: {
              select: {
                id: true,
                title: true,
                images: true,
                amount: true,
                city: true,
                state: true,
              },
            },
            renter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
                isVerified: true,
              },
            },
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
                isVerified: true,
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                content: true,
                messageType: true,
                isRead: true,
                createdAt: true,
                senderId: true,
              },
            },
            _count: {
              select: {
                messages: {
                  where: { isRead: false, senderId: { not: userId } },
                },
              },
            },
          },
          skip,
          take: validatedLimit,
          orderBy: { updatedAt: "desc" },
        }),
        this.prisma.conversation.count({ where }),
      ]);

      // Transform conversations to include participant info
      const transformedConversations = conversations.map((conv) => ({
        ...conv,
        participant: conv.renterId === userId ? conv.owner : conv.renter,
        lastMessage: conv.messages[0] || null,
        unreadCount: conv._count.messages,
      }));

      const pagination = this.buildPagination(page, validatedLimit, totalCount);

      const result = {
        conversations: transformedConversations,
        totalCount,
        pagination,
      };

      // Cache for 2 minutes
      await this.setCache(cacheKey, result, 120);

      return this.success(result, "Conversations retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getConversations");
    }
  }

  async getConversationById(
    conversationId: string,
    userId: string
  ): Promise<IBaseResponse<any>> {
    try {
      const cacheKey = this.generateCacheKey(
        "conversation",
        conversationId,
        userId
      );

      // Try cache first
      const cached = await this.getCache<any>(cacheKey);
      if (cached) {
        return this.success(cached, "Conversation retrieved from cache");
      }

      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ renterId: userId }, { ownerId: userId }],
        },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              images: true,
              amount: true,
              city: true,
              state: true,
            },
          },
          renter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
              isVerified: true,
            },
          },
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
              isVerified: true,
            },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Add participant info
      const transformedConversation = {
        ...conversation,
        participant:
          conversation.renterId === userId
            ? conversation.owner
            : conversation.renter,
      };

      // Cache for 5 minutes
      await this.setCache(cacheKey, transformedConversation, 300);

      return this.success(
        transformedConversation,
        "Conversation retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getConversationById");
    }
  }

  async getMessages(
    filters: MessageFilters & { conversationId: string },
    page = 1,
    limit = 50
  ): Promise<
    IBaseResponse<{ messages: any[]; totalCount: number; pagination: any }>
  > {
    try {
      const { conversationId, messageType, fromDate, toDate } = filters;
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      const cacheKey = this.generateCacheKey(
        "messages",
        conversationId,
        JSON.stringify({ messageType, fromDate, toDate }),
        page.toString()
      );

      // Try cache first
      const cached = await this.getCache<any>(cacheKey);
      if (cached) {
        return this.success(cached, "Messages retrieved from cache");
      }

      // Build where clause
      const where: any = { conversationId };

      if (messageType) where.messageType = messageType;
      if (fromDate) where.createdAt = { ...where.createdAt, gte: fromDate };
      if (toDate) where.createdAt = { ...where.createdAt, lte: toDate };

      const [messages, totalCount] = await Promise.all([
        this.prisma.message.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
          skip,
          take: validatedLimit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.message.count({ where }),
      ]);

      const pagination = this.buildPagination(page, validatedLimit, totalCount);

      const result = {
        messages: messages.reverse(), // Show oldest first
        totalCount,
        pagination,
      };

      // Cache for 1 minute
      await this.setCache(cacheKey, result, 60);

      return this.success(result, "Messages retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getMessages");
    }
  }

  async sendMessage(
    senderId: string,
    input: SendMessageInput
  ): Promise<IBaseResponse<any>> {
    try {
      const {
        conversationId,
        content,
        messageType = MessageType.TEXT,
        attachments = [],
      } = input;

      // Verify conversation exists and user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ renterId: senderId }, { ownerId: senderId }],
          isActive: true,
        },
        include: {
          property: { select: { id: true, title: true } },
          renter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Create message
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          content,
          messageType,
          attachments,
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          conversation: {
            include: {
              property: { select: { id: true, title: true } },
            },
          },
        },
      });

      // Update conversation timestamp
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Determine recipient
      const recipient =
        conversation.renterId === senderId
          ? conversation.owner
          : conversation.renter;
      const sender =
        conversation.renterId === senderId
          ? conversation.renter
          : conversation.owner;

      // Publish to real-time subscription
      await (pubSub as RedisPubSub).publish(SUBSCRIPTION_EVENTS.MESSAGE_SENT, {
        message,
        conversationId,
        recipientId: recipient.id,
      });

      // Create notification for recipient
      await this.notificationService.createNotification({
        userId: recipient.id,
        title: "New Message",
        message: `${sender.firstName} ${sender.lastName} sent you a message about "${conversation.property.title}"`,
        type: NotificationType.NEW_MESSAGE,
        data: {
          conversationId,
          messageId: message.id,
          senderId,
          propertyId: conversation.property.id,
        },
      });

      // Send email notification
      await this.emailService.sendChatNotification(
        recipient.email,
        recipient.firstName,
        `${sender.firstName} ${sender.lastName}`,
        conversation.property.title,
        content.substring(0, 100),
        conversationId
      );

      // Clear caches
      await Promise.all([
        this.deleteCachePattern(`conversations:${recipient.id}:*`),
        this.deleteCachePattern(`conversations:${senderId}:*`),
        this.deleteCachePattern(`messages:${conversationId}:*`),
      ]);

      return this.success(message, "Message sent successfully");
    } catch (error: unknown) {
      return this.handleError(error, "sendMessage");
    }
  }

  async markMessagesAsRead(
    conversationId: string,
    userId: string
  ): Promise<IBaseResponse<{ updatedCount: number }>> {
    try {
      // Verify user is participant in conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ renterId: userId }, { ownerId: userId }],
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Mark all unread messages from other participant as read
      const updateResult = await this.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          isRead: false,
        },
        data: { isRead: true },
      });

      // Clear caches
      await Promise.all([
        this.deleteCachePattern(`conversations:${userId}:*`),
        this.deleteCachePattern(`messages:${conversationId}:*`),
      ]);

      return this.success(
        { updatedCount: updateResult.count },
        `${updateResult.count} messages marked as read`
      );
    } catch (error: unknown) {
      return this.handleError(error, "markMessagesAsRead");
    }
  }

  async deleteMessage(
    messageId: string,
    userId: string
  ): Promise<IBaseResponse<null>> {
    try {
      // Verify message exists and user is sender
      const message = await this.prisma.message.findFirst({
        where: { id: messageId, senderId: userId },
        include: { conversation: true },
      });

      if (!message) {
        return this.failure("Message not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Delete message
      await this.prisma.message.delete({
        where: { id: messageId },
      });

      // Clear caches
      await Promise.all([
        this.deleteCachePattern(`messages:${message.conversationId}:*`),
        this.deleteCachePattern(`conversations:${userId}:*`),
      ]);

      return this.success(null, "Message deleted successfully");
    } catch (error: unknown) {
      return this.handleError(error, "deleteMessage");
    }
  }

  async archiveConversation(
    conversationId: string,
    userId: string
  ): Promise<IBaseResponse<null>> {
    try {
      // Verify user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ renterId: userId }, { ownerId: userId }],
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Archive conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { isActive: false },
      });

      // Clear caches
      await this.deleteCachePattern(`conversations:${userId}:*`);

      return this.success(null, "Conversation archived successfully");
    } catch (error: unknown) {
      return this.handleError(error, "archiveConversation");
    }
  }

  async getUnreadMessageCount(
    userId: string
  ): Promise<IBaseResponse<{ count: number }>> {
    try {
      const cacheKey = this.generateCacheKey("unread_messages", userId);

      // Try cache first
      const cached = await this.getCache<{ count: number }>(cacheKey);
      if (cached) {
        return this.success(cached, "Unread count retrieved from cache");
      }

      const count = await this.prisma.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: {
            OR: [{ renterId: userId }, { ownerId: userId }],
            isActive: true,
          },
        },
      });

      const result = { count };

      // Cache for 1 minute
      await this.setCache(cacheKey, result, 60);

      return this.success(
        result,
        "Unread message count retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getUnreadMessageCount");
    }
  }

  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
    page = 1,
    limit = 20
  ): Promise<
    IBaseResponse<{
      messages: {
        id: string;
        content: string;
        createdAt: Date;
        messageType: string;
        attachments: string[];
        isRead: boolean;
        sender: {
          id: string;
          firstName: string;
          lastName: string;
          profilePic: string | null;
        };
      }[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      // ✅ Check if user is part of the conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [{ renterId: userId }, { ownerId: userId }],
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // ✅ Validate pagination
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      // ✅ Construct message search filter
      const where: Prisma.MessageWhereInput = {
        conversationId,
        content: {
          contains: query,
          mode: "insensitive",
        },
      };

      const [messages, totalCount] = await Promise.all([
        this.prisma.message.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePic: true,
              },
            },
          },
          skip,
          take: validatedLimit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.message.count({ where }),
      ]);

      const pagination = this.buildPagination(page, validatedLimit, totalCount);

      return this.success(
        { messages, totalCount, pagination },
        "Message search completed successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "searchMessages");
    }
  }
}

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
} from "../types/services/conversation";
import { RedisPubSub } from "graphql-redis-subscriptions";

export class ConversationService extends BaseService {
  private notificationService: NotificationService;
  private emailService: EmailService;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.notificationService = new NotificationService(prisma, redis);
    this.emailService = new EmailService(prisma, redis);
  }

  async createConversation(
    input: CreateConversationInput & { initiatorId: string }
  ): Promise<IBaseResponse<any>> {
    try {
      const { participantIds, propertyId, initiatorId } = input;

      // Validate participants
      if (!participantIds.includes(initiatorId)) {
        return this.failure("Initiator must be a participant", [
          StatusCodes.BAD_REQUEST,
        ]);
      }

      if (participantIds.length < 2) {
        return this.failure("At least two participants are required", [
          StatusCodes.BAD_REQUEST,
        ]);
      }

      // Verify all participants exist and are active
      const participants = await this.prisma.user.findMany({
        where: {
          id: { in: participantIds },
          isActive: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePic: true,
          isVerified: true,
        },
      });

      if (participants.length !== participantIds.length) {
        return this.failure("One or more participants not found or inactive", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Verify property exists if provided
      let property;
      if (propertyId) {
        property = await this.prisma.property.findFirst({
          where: { id: propertyId },
          select: { id: true, title: true, images: true },
        });

        if (!property) {
          return this.failure("Property not found", [StatusCodes.NOT_FOUND]);
        }
      }

      // Check for existing conversation with same participants and property
      const existingConversation = await this.prisma.conversation.findFirst({
        where: {
          propertyId: propertyId || null,
          participants: {
            every: { userId: { in: participantIds } },
            none: { userId: { notIn: participantIds } },
          },
        },
        include: { participants: { include: { user: true } } },
      });

      if (existingConversation) {
        return this.success(
          existingConversation,
          "Conversation already exists"
        );
      }

      // Create new conversation
      const conversation = await this.prisma.conversation.create({
        data: {
          propertyId: propertyId || null,
          participants: {
            create: participantIds.map((userId) => ({
              userId,
            })),
          },
        },
        include: {
          property: {
            select: { id: true, title: true, images: true },
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePic: true,
                  isVerified: true,
                },
              },
            },
          },
          _count: { select: { messages: true } },
        },
      });

      // Clear cache for all participants
      await Promise.all(
        participantIds.map((userId) =>
          this.deleteCachePattern(`conversations:${userId}:*`)
        )
      );

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
        participants: { some: { userId } },
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
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profilePic: true,
                    isVerified: true,
                  },
                },
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
        participants: conv.participants.map((p) => p.user),
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
      await this.setCache(cacheKey, result, 120 as any);

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
          participants: { some: { userId } },
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
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePic: true,
                  isVerified: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", [
          StatusCodes.NOT_FOUND,
        ]);
      }

      // Transform conversation to include participant info
      const transformedConversation = {
        ...conversation,
        participants: conversation.participants.map((p) => p.user),
      };

      // Cache for 5 minutes
      await this.setCache(cacheKey, transformedConversation, 300 as any);

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
      await this.setCache(cacheKey, result, 60 as any);

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
          participants: { some: { userId: senderId } },
          isActive: true,
        },
        include: {
          property: { select: { id: true, title: true } },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
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

      // Determine recipients (all participants except sender)
      const recipients = conversation.participants
        .map((p) => p.user)
        .filter((user) => user.id !== senderId);

      // Publish to real-time subscription
      await (pubSub as RedisPubSub).publish(SUBSCRIPTION_EVENTS.MESSAGE_SENT, {
        message,
        conversationId,
        recipientIds: recipients.map((r) => r.id),
      });

      // Create notifications and send emails for recipients
      await Promise.all(
        recipients.map(async (recipient) => {
          const notificationTitle = conversation.property
            ? `New Message about "${conversation.property.title}"`
            : `New Message from ${message.sender.firstName} ${message.sender.lastName}`;

          await this.notificationService.createNotification({
            userId: recipient.id,
            title: notificationTitle,
            message: `${message.sender.firstName} ${message.sender.lastName} sent you a message`,
            type: NotificationType.NEW_MESSAGE,
            data: {
              conversationId,
              messageId: message.id,
              senderId,
              propertyId: conversation.property?.id,
            },
          });

          await this.emailService.sendChatNotification(
            recipient.email,
            recipient.firstName,
            `${message.sender.firstName} ${message.sender.lastName}`,
            conversation.property?.title || "Direct Message",
            content.substring(0, 100),
            conversationId
          );
        })
      );

      // Clear caches for all participants
      await Promise.all(
        conversation.participants.map((p) =>
          this.deleteCachePattern(`conversations:${p.user.id}:*`)
        )
      );
      await this.deleteCachePattern(`messages:${conversationId}:*`);

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
          participants: { some: { userId } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied",);
      }

      // Mark all unread messages from other participants as read
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
        return this.failure("Message not found or access denied", );
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
          participants: { some: { userId } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", );
      }

      // Archive conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { isActive: false },
      });

      // Clear caches for all participants
      const participants = await this.prisma.userConversation.findMany({
        where: { conversationId },
        select: { userId: true },
      });

      await Promise.all(
        participants.map((p) =>
          this.deleteCachePattern(`conversations:${p.userId}:*`)
        )
      );

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
            participants: { some: { userId } },
            isActive: true,
          },
        },
      });

      const result = { count };

      // Cache for 1 minute
      await this.setCache(cacheKey, result, 60 as any);

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
      // Verify user is part of the conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied", );
      }

      // Validate pagination
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      // Construct message search filter
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

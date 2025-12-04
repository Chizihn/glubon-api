import {
  PrismaClient,
  MessageType,
  NotificationType,
  Prisma,
} from "@prisma/client";
import Redis from "ioredis";
import { BaseService } from "./base";
// import { Container } from "../container";
import {
  CreateConversationInput,
  SendMessageInput,
  ConversationFilters,
  MessageFilters,
  TypingStatusInput,
  MessageSearchInput,
  MarkMessagesAsReadInput,
  UpdateMessageInput,
  DeleteMessageInput,
} from "../modules/chat/chat.inputs";
import { IBaseResponse } from "../types";
import { pubSub, SUBSCRIPTION_EVENTS } from "../utils";

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";
import { NotificationService } from "./notification";

@Service()
export class ChatService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis,
    private notificationService: NotificationService
  ) {
    super(prisma, redis);
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    userId: string,
    input: CreateConversationInput
  ): Promise<IBaseResponse<{ conversation: any; isNew: boolean }>> {
    try {
      const { participantIds, propertyId, initialMessage } = input;

      // Ensure the creator is included in participants
      const allParticipants = Array.from(new Set([userId, ...participantIds]));

      if (allParticipants.length < 2) {
        return this.failure("At least two participants are required");
      }

      // Verify all participants exist and are active
      const participants = await this.prisma.user.findMany({
        where: {
          id: { in: allParticipants },
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

      if (participants.length !== allParticipants.length) {
        return this.failure("One or more participants not found or inactive");
      }

      // Verify property exists if provided
      if (propertyId) {
        const property = await this.prisma.property.findFirst({
          where: { id: propertyId, status: "ACTIVE" },
        });

        if (!property) {
          return this.failure("Property not found or not active");
        }
      }

      // Check for existing conversation with same participants and property
      const existingConversation = await this.findExistingConversation(
        allParticipants,
        propertyId
      );

      if (existingConversation) {
        // Reactivate if archived
        if (!existingConversation.isActive) {
          await this.prisma.conversation.update({
            where: { id: existingConversation.id },
            data: { isActive: true },
          });
        }

        const transformedExisting = {
          ...existingConversation,
          participants: existingConversation.participants.map((p) => p.user),
          unreadCount: 0,
        };

        return this.success(
          { conversation: transformedExisting, isNew: false },
          "Existing conversation found"
        );
      }

      // Create new conversation with transaction
      const conversation = await this.prisma.$transaction(async (tx) => {
        const newConversation = await tx.conversation.create({
          data: {
            propertyId: propertyId || null,
            participants: {
              create: allParticipants.map((participantId) => ({
                userId: participantId,
              })),
            },
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

        // Send initial message if provided
        if (initialMessage) {
          await tx.message.create({
            data: {
              conversationId: newConversation.id,
              senderId: userId,
              content: initialMessage,
              messageType: MessageType.TEXT,
            },
          });
        }

        return newConversation;
      });

      // Transform conversation data
      const transformedConversation = {
        ...conversation,
        participants: conversation.participants.map((p) => p.user),
        unreadCount: 0,
      };

      // Publish conversation created event
      await (pubSub as any).publish(SUBSCRIPTION_EVENTS.CONVERSATION_CREATED, {
        conversation: transformedConversation,
        action: "created",
      });

      // Clear cache for all participants
      await this.clearParticipantCaches(allParticipants);

      return this.success(
        { conversation: transformedConversation, isNew: true },
        "Conversation created successfully"
      );
    } catch (error) {
      return this.handleError(error, "createConversation");
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    userId: string,
    input: SendMessageInput
  ): Promise<IBaseResponse<{ message: any; conversationId: string }>> {
    try {
      const {
        conversationId,
        recipientIds,
        content,
        messageType,
        attachments,
        propertyId,
      } = input;

      let targetConversationId = conversationId;

      // If no conversationId provided, create or find conversation
      if (!conversationId) {
        if (!recipientIds || recipientIds.length === 0) {
          return this.failure(
            "Either conversationId or recipientIds must be provided"
          );
        }

        const createInput: CreateConversationInput = {
          participantIds: recipientIds,
        };
        if (propertyId) {
          createInput.propertyId = propertyId;
        }
        const createResult = await this.createConversation(userId, createInput);

        if (!createResult.success || !createResult.data) {
          return createResult as any;
        }

        targetConversationId = createResult.data.conversation.id;
      }

      // Verify user is participant in conversation
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: targetConversationId!,
          participants: { some: { userId } },
          isActive: true,
        },
        include: {
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
          property: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      // Create message
      const message = await this.prisma.$transaction(async (tx) => {
        const newMessage = await tx.message.create({
          data: {
            conversationId: targetConversationId!,
            senderId: userId,
            content,
            messageType: messageType || MessageType.TEXT,
            attachments: attachments || [],
            propertyId: propertyId || null,
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
          },
        });

        // Update conversation timestamp
        await tx.conversation.update({
          where: { id: targetConversationId! },
          data: { updatedAt: new Date() },
        });

        return newMessage;
      });

      // Get all participants including sender
      const participants = conversation.participants.map((p) => p.user);
      
      // Get recipients (all participants except sender for notifications)
      const recipients = participants.filter((user) => user.id !== userId);

      // Publish message sent event to all participants including sender
      const messagePayload = {
        message,
        conversationId: targetConversationId!,
        recipientIds: participants.map((p) => p.id), // Include sender in subscription
      };

      await (pubSub as any).publish(
        SUBSCRIPTION_EVENTS.MESSAGE_SENT,
        messagePayload
      );

      // Send notifications to recipients
      await this.sendMessageNotifications(recipients, message, conversation);

      // Clear caches
      await this.clearConversationCaches(targetConversationId!, [
        userId,
        ...recipients.map((r) => r.id),
      ]);

      return this.success(
        { message, conversationId: targetConversationId! },
        "Message sent successfully"
      );
    } catch (error) {
      return this.handleError(error, "sendMessage");
    }
  }

  /**
   * Get conversations for a user
   */
  async getConversations(
    userId: string,
    filters: ConversationFilters,
    page = 1,
    limit = 20
  ): Promise<IBaseResponse<{ conversations: any[]; totalCount: number }>> {
    try {
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      const cacheKey = this.generateCacheKey(
        "conversations",
        userId,
        JSON.stringify(filters),
        page.toString(),
        limit.toString()
      );

      // Try cache first
      const cached = await this.getCache<{
        conversations: any[];
        totalCount: number;
      }>(cacheKey);
      if (cached) {
        return this.success(cached, "Conversations retrieved from cache");
      }

      // Build where clause
      const where: Prisma.ConversationWhereInput = {
        participants: { some: { userId } },
      };

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.propertyId) {
        where.propertyId = filters.propertyId;
      }

      if (filters.search) {
        where.OR = [
          {
            property: {
              title: { contains: filters.search, mode: "insensitive" },
            },
          },
          {
            participants: {
              some: {
                user: {
                  OR: [
                    {
                      firstName: {
                        contains: filters.search,
                        mode: "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains: filters.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          },
        ];
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
            },
            _count: {
              select: {
                messages: {
                  where: {
                    isRead: false,
                    senderId: { not: userId },
                  },
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

      // Transform conversations
      const transformedConversations = conversations.map((conv) => ({
        ...conv,
        participants: conv.participants.map((p) => p.user),
        lastMessage: conv.messages[0] || null,
        unreadCount: conv._count.messages,
      }));

      const result = {
        conversations: transformedConversations,
        totalCount,
      };

      // Cache for 2 minutes
      await this.setCache(cacheKey, result, 120 as any);

      return this.success(result, "Conversations retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getConversations");
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(
    userId: string,
    conversationId: string,
    filters: MessageFilters,
    page = 1,
    limit = 50
  ): Promise<IBaseResponse<{ messages: any[]; totalCount: number }>> {
    try {
      // Verify user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      const cacheKey = this.generateCacheKey(
        "messages",
        conversationId,
        JSON.stringify(filters),
        page.toString(),
        limit.toString()
      );

      // Try cache first
      const cached = await this.getCache<{
        messages: any[];
        totalCount: number;
      }>(cacheKey);
      if (cached) {
        return this.success(cached, "Messages retrieved from cache");
      }

      // Build where clause
      const where: Prisma.MessageWhereInput = { conversationId };

      if (filters.messageType) where.messageType = filters.messageType;
      if (filters.senderId) where.senderId = filters.senderId;
      if (filters.isRead !== undefined) where.isRead = filters.isRead;
      if (filters.fromDate) {
        where.createdAt = { gte: filters.fromDate };
      }
      if (filters.toDate) {
        if (where.createdAt && typeof where.createdAt === "object") {
          (where.createdAt as any).lte = filters.toDate;
        } else {
          where.createdAt = { lte: filters.toDate };
        }
      }

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
            property: {
              select: {
                id: true,
                title: true,
                images: true,
                amount: true,
                city: true,
                state: true,
                address: true,
                listingType: true,
                rentalPeriod: true,
              },
            },
          },
          skip,
          take: validatedLimit,
          orderBy: { createdAt: "desc" }, // Latest first for pagination
        }),
        this.prisma.message.count({ where }),
      ]);

      const result = {
        messages,
        totalCount,
      };

      // Cache for 1 minute
      await this.setCache(cacheKey, result, 60 as any);

      return this.success(result, "Messages retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getMessages");
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    userId: string,
    input: MarkMessagesAsReadInput
  ): Promise<IBaseResponse<{ updatedCount: number }>> {
    try {
      const { conversationId, messageIds } = input;

      // Verify user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      // Build where clause for messages to mark as read
      const where: Prisma.MessageWhereInput = {
        conversationId,
        senderId: { not: userId }, // Don't mark own messages as read
        isRead: false,
      };

      if (messageIds && messageIds.length > 0) {
        where.id = { in: messageIds };
      }

      // Mark messages as read
      const updateResult = await this.prisma.message.updateMany({
        where,
        data: { isRead: true },
      });

      // Clear caches
      await this.clearConversationCaches(conversationId, [userId]);

      return this.success(
        { updatedCount: updateResult.count },
        `${updateResult.count} messages marked as read`
      );
    } catch (error) {
      return this.handleError(error, "markMessagesAsRead");
    }
  }

  /**
   * Send typing status
   */
  async sendTypingStatus(
    userId: string,
    input: TypingStatusInput
  ): Promise<IBaseResponse<boolean>> {
    try {
      const { conversationId, isTyping } = input;

      // Verify user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profilePic: true,
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      const user = conversation.participants.find(
        (p) => p.user.id === userId
      )?.user;
      if (!user) {
        return this.failure("User not found in conversation");
      }

      // Publish typing status
      const typingPayload = {
        typingStatus: {
          conversationId,
          userId,
          user,
          isTyping,
          timestamp: new Date(),
        },
      };

      await (pubSub as any).publish(
        SUBSCRIPTION_EVENTS.TYPING_STATUS,
        typingPayload
      );

      // Store typing status in Redis with expiration
      const typingKey = `typing:${conversationId}:${userId}`;
      if (isTyping) {
        await this.redis.setex(typingKey, 10, "1"); // Expire after 10 seconds
      } else {
        await this.redis.del(typingKey);
      }

      return this.success(true, "Typing status sent");
    } catch (error) {
      return this.handleError(error, "sendTypingStatus");
    }
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(
    userId: string
  ): Promise<IBaseResponse<{ totalUnread: number }>> {
    try {
      const cacheKey = this.generateCacheKey("unread_count", userId);

      // Try cache first
      const cached = await this.getCache<{ totalUnread: number }>(cacheKey);
      if (cached) {
        return this.success(cached, "Unread count retrieved from cache");
      }

      const totalUnread = await this.prisma.message.count({
        where: {
          isRead: false,
          senderId: { not: userId },
          conversation: {
            participants: { some: { userId } },
            isActive: true,
          },
        },
      });

      const result = { totalUnread };

      // Cache for 30 seconds
      await this.setCache(cacheKey, result, 30 as any);

      return this.success(result, "Unread count retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getUnreadCount");
    }
  }

  /**
   * Get conversation by ID
   */
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
          _count: {
            select: {
              messages: {
                where: {
                  isRead: false,
                  senderId: { not: userId },
                },
              },
            },
          },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      // Transform conversation
      const transformedConversation = {
        ...conversation,
        participants: conversation.participants.map((p) => p.user),
        unreadCount: conversation._count.messages,
      };

      // Cache for 5 minutes
      await this.setCache(cacheKey, transformedConversation, 300 as any);

      return this.success(
        transformedConversation,
        "Conversation retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getConversationById");
    }
  }

  /**
   * Search messages
   */
  async searchMessages(
    userId: string,
    input: MessageSearchInput,
    page = 1,
    limit = 20
  ): Promise<IBaseResponse<{ messages: any[]; totalCount: number }>> {
    try {
      const { query, conversationId, messageType, fromDate, toDate } = input;
      const { skip, limit: validatedLimit } = this.validatePagination(
        page,
        limit
      );

      // Build where clause
      const where: Prisma.MessageWhereInput = {
        content: {
          contains: query,
          mode: "insensitive",
        },
        conversation: {
          participants: { some: { userId } },
        },
      };

      if (conversationId) where.conversationId = conversationId;
      if (messageType) where.messageType = messageType;
      if (fromDate) {
        where.createdAt = { gte: fromDate };
      }
      if (toDate) {
        if (where.createdAt && typeof where.createdAt === "object") {
          (where.createdAt as any).lte = toDate;
        } else {
          where.createdAt = { lte: toDate };
        }
      }

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
          },
          skip,
          take: validatedLimit,
          orderBy: { createdAt: "desc" },
        }),
        this.prisma.message.count({ where }),
      ]);

      return this.success(
        { messages, totalCount },
        "Message search completed successfully"
      );
    } catch (error) {
      return this.handleError(error, "searchMessages");
    }
  }

  /**
   * Update a message
   */
  async updateMessage(
    userId: string,
    input: UpdateMessageInput
  ): Promise<IBaseResponse<any>> {
    try {
      const { messageId, content, attachments } = input;

      // Verify message exists and user is sender
      const existingMessage = await this.prisma.message.findFirst({
        where: { id: messageId, senderId: userId },
        include: { conversation: true },
      });

      if (!existingMessage) {
        return this.failure("Message not found or access denied");
      }

      // Update message
      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          content,
          attachments: attachments || existingMessage.attachments,
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
        },
      });

      // Clear caches
      await this.clearConversationCaches(existingMessage.conversationId, [
        userId,
      ]);

      return this.success(updatedMessage, "Message updated successfully");
    } catch (error) {
      return this.handleError(error, "updateMessage");
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    userId: string,
    input: DeleteMessageInput
  ): Promise<IBaseResponse<boolean>> {
    try {
      const { messageId, deleteForEveryone } = input;

      // Verify message exists and user has permission
      const message = await this.prisma.message.findFirst({
        where: { id: messageId },
        include: {
          conversation: {
            include: {
              participants: { select: { userId: true } },
            },
          },
        },
      });

      if (!message) {
        return this.failure("Message not found");
      }

      // Check permissions
      const isParticipant = message.conversation.participants.some(
        (p) => p.userId === userId
      );
      const isSender = message.senderId === userId;

      if (!isParticipant) {
        return this.failure("Access denied");
      }

      if (deleteForEveryone && !isSender) {
        return this.failure("Only sender can delete message for everyone");
      }

      // Delete message completely
      await this.prisma.message.delete({
        where: { id: messageId },
      });

      // Clear caches
      const participantIds = message.conversation.participants.map(
        (p) => p.userId
      );
      await this.clearConversationCaches(
        message.conversationId,
        participantIds
      );

      return this.success(true, "Message deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteMessage");
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: string,
    userId: string
  ): Promise<IBaseResponse<boolean>> {
    try {
      // Verify user is participant
      const conversation = await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          participants: { some: { userId } },
        },
        include: {
          participants: { select: { userId: true } },
        },
      });

      if (!conversation) {
        return this.failure("Conversation not found or access denied");
      }

      // Archive conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { isActive: false },
      });

      // Clear caches for all participants
      const participantIds = conversation.participants.map((p) => p.userId);
      await this.clearParticipantCaches(participantIds);

      return this.success(true, "Conversation archived successfully");
    } catch (error) {
      return this.handleError(error, "archiveConversation");
    }
  }

  // Helper methods
  private async findExistingConversation(
    participantIds: string[],
    propertyId?: string
  ) {
    return this.prisma.conversation.findFirst({
      where: {
        propertyId: propertyId || null,
        participants: {
          every: { userId: { in: participantIds } },
          none: { userId: { notIn: participantIds } },
        },
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
  }

  private async sendMessageNotifications(
    recipients: any[],
    message: any,
    conversation: any
  ) {
    await Promise.all(
      recipients.map(async (recipient) => {
        const notificationTitle = conversation.property
          ? `New message about "${conversation.property.title}"`
          : `New message from ${message.sender.firstName} ${message.sender.lastName}`;

        await this.notificationService.createNotification({
          userId: recipient.id,
          title: notificationTitle,
          message: `${message.sender.firstName} ${message.sender.lastName} sent you a message`,
          type: NotificationType.NEW_MESSAGE,
          data: {
            conversationId: conversation.id,
            messageId: message.id,
            senderId: message.senderId,
            propertyId: conversation.property?.id,
          },
        });
      })
    );
  }

  private async clearParticipantCaches(participantIds: string[]) {
    await Promise.all(
      participantIds.map((id) =>
        this.deleteCachePattern(`conversations:${id}:*`)
      )
    );
  }

  private async clearConversationCaches(
    conversationId: string,
    participantIds: string[]
  ) {
    await Promise.all([
      this.deleteCachePattern(`messages:${conversationId}:*`),
      ...participantIds.map((id) =>
        this.deleteCachePattern(`conversations:${id}:*`)
      ),
      ...participantIds.map((id) =>
        this.deleteCachePattern(`unread_count:${id}`)
      ),
    ]);
  }
}

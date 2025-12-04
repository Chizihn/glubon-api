import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  UseMiddleware,
  Arg,
  Ctx,
  Root,
  Int,
  ID,
} from "type-graphql";
import { Context } from "../../types/context";
import { ChatService } from "../../services";
import { AuthMiddleware } from "../../middleware";
import { SUBSCRIPTION_EVENTS } from "../../utils/pubsub";
import {
  Conversation,
  Message,
  PaginatedConversations,
  PaginatedMessages,
  SendMessageResponse,
  CreateConversationResponse,
  MarkAsReadResponse,
  UnreadCountResponse,
  TypingStatus,
  MessageSentPayload,
  ConversationUpdatedPayload,
  TypingStatusPayload,
  PresenceUpdatePayload,
  PaginatedBroadcastMessagesResponse,
  BroadcastMessageResponse,
} from "./chat.types";
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
} from "./chat.inputs";
import {
  BroadcastMessageInput,
  BroadcastMessageFilter,
} from "./broadcast.inputs";
import { Prisma, PrismaClient, RoleEnum } from "@prisma/client";
import { pubSub } from "../../utils";
import { UserPresence } from "../presence/presence.types";

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN } from "../../types/di-tokens";

@Service()
@Resolver()
export class ChatResolver {
  constructor(
    private chatService: ChatService,
    @Inject(PRISMA_TOKEN) private prisma: PrismaClient
  ) {}

  // Queries
  @Query(() => PaginatedConversations)
  @UseMiddleware(AuthMiddleware)
  async getConversations(
    @Arg("filters", { nullable: true }) filters: ConversationFilters = {},
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedConversations> {
    const result = await this.chatService.getConversations(
      ctx.user!.id,
      filters,
      page,
      limit
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return new PaginatedConversations(
      result.data.conversations,
      page,
      limit,
      result.data.totalCount
    );
  }

  @Query(() => Conversation)
  @UseMiddleware(AuthMiddleware)
  async getConversation(
    @Arg("conversationId", () => ID) conversationId: string,
    @Ctx() ctx: Context
  ): Promise<Conversation> {
    const result = await this.chatService.getConversationById(
      conversationId,
      ctx.user!.id
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return result.data;
  }

  @Query(() => PaginatedMessages)
  @UseMiddleware(AuthMiddleware)
  async getMessages(
    @Arg("conversationId", () => ID) conversationId: string,
    @Arg("filters", { nullable: true }) filters: MessageFilters = {},
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedMessages> {
    const result = await this.chatService.getMessages(
      ctx.user!.id,
      conversationId,
      filters,
      page,
      limit
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return new PaginatedMessages(
      result.data.messages,
      page,
      limit,
      result.data.totalCount
    );
  }

  @Query(() => UnreadCountResponse)
  @UseMiddleware(AuthMiddleware)
  async getUnreadMessageCount(
    @Ctx() ctx: Context
  ): Promise<UnreadCountResponse> {
    const result = await this.chatService.getUnreadCount(ctx.user!.id);

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return {
      totalUnread: result.data.totalUnread,
      conversationCounts: [], // TODO: Implement per-conversation counts if needed
    };
  }

  @Query(() => PaginatedMessages)
  @UseMiddleware(AuthMiddleware)
  async searchMessages(
    @Arg("input") input: MessageSearchInput,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedMessages> {
    const result = await this.chatService.searchMessages(
      ctx.user!.id,
      input,
      page,
      limit
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return new PaginatedMessages(
      result.data.messages,
      page,
      limit,
      result.data.totalCount
    );
  }

  // Mutations
  @Mutation(() => CreateConversationResponse)
  @UseMiddleware(AuthMiddleware)
  async createConversation(
    @Arg("input") input: CreateConversationInput,
    @Ctx() ctx: Context
  ): Promise<CreateConversationResponse> {
    const result = await this.chatService.createConversation(
      ctx.user!.id,
      input
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return {
      conversation: result.data.conversation,
      success: true,
      isNew: result.data.isNew,
    };
  }

  @Mutation(() => SendMessageResponse)
  @UseMiddleware(AuthMiddleware)
  async sendMessage(
    @Arg("input") input: SendMessageInput,
    @Ctx() ctx: Context
  ): Promise<SendMessageResponse> {
    const result = await this.chatService.sendMessage(ctx.user!.id, input);

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return {
      message: result.data.message,
      success: true,
      conversationId: result.data.conversationId,
    };
  }

  @Mutation(() => MarkAsReadResponse)
  @UseMiddleware(AuthMiddleware)
  async markMessagesAsRead(
    @Arg("input") input: MarkMessagesAsReadInput,
    @Ctx() ctx: Context
  ): Promise<MarkAsReadResponse> {
    const result = await this.chatService.markMessagesAsRead(
      ctx.user!.id,
      input
    );

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return {
      updatedCount: result.data.updatedCount,
      success: true,
    };
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async sendTypingStatus(
    @Arg("input") input: TypingStatusInput,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.chatService.sendTypingStatus(ctx.user!.id, input);

    if (!result.success) {
      throw new Error(result.message);
    }

    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteMessage(
    @Arg("input") input: DeleteMessageInput,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.chatService.deleteMessage(ctx.user!.id, input);

    if (!result.success) {
      throw new Error(result.message);
    }

    return true;
  }

  @Mutation(() => Message)
  @UseMiddleware(AuthMiddleware)
  async updateMessage(
    @Arg("input") input: UpdateMessageInput,
    @Ctx() ctx: Context
  ): Promise<Message> {
    const result = await this.chatService.updateMessage(ctx.user!.id, input);

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    return result.data;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async archiveConversation(
    @Arg("conversationId", () => ID) conversationId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.chatService.archiveConversation(
      conversationId,
      ctx.user!.id
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return true;
  }

  // Subscriptions
  @Subscription(() => Message, {
    topics: SUBSCRIPTION_EVENTS.MESSAGE_SENT,
    filter: ({
      payload,
      context,
    }: {
      payload: MessageSentPayload;
      context: Context;
    }) => {
      return payload.recipientIds.includes(context.user?.id ?? "");
    },
  })
  async messageSent(
    @Root() payload: MessageSentPayload,
    @Ctx() ctx: Context
  ): Promise<Message> {
    return payload.message;
  }

  @Subscription(() => Message, {
    topics: SUBSCRIPTION_EVENTS.MESSAGE_SENT,
    filter: ({
      payload,
      args,
    }: {
      payload: MessageSentPayload;
      args: { conversationId: string };
    }) => {
      // Only filter by conversation ID for now to ensure messages are delivered
      return payload.conversationId === args.conversationId;
    },
  })
  async conversationMessages(
    @Arg("conversationId", () => ID) conversationId: string,
    @Root() payload: MessageSentPayload,
    @Ctx() ctx: Context
  ): Promise<Message> {
    return payload.message;
  }

  @Subscription(() => Conversation, {
    topics: SUBSCRIPTION_EVENTS.CONVERSATION_CREATED,
    filter: ({
      payload,
      context,
    }: {
      payload: ConversationUpdatedPayload;
      context: Context;
    }) => {
      return payload.conversation.participants.some(
        (p) => p.id === context.user?.id
      );
    },
  })
  async conversationUpdated(
    @Root() payload: ConversationUpdatedPayload,
    @Ctx() ctx: Context
  ): Promise<Conversation> {
    return payload.conversation;
  }

  @Subscription(() => TypingStatus, {
    topics: SUBSCRIPTION_EVENTS.TYPING_STATUS,
    filter: ({
      payload,
      args,
    }: {
      payload: TypingStatusPayload;
      args: { conversationId: string };
    }) => {
      return payload.typingStatus.conversationId === args.conversationId;
    },
  })
  async typingStatus(
    @Arg("conversationId", () => ID) conversationId: string,
    @Root() payload: TypingStatusPayload
  ): Promise<TypingStatus> {
    return payload.typingStatus;
  }

  @Subscription(() => UserPresence, {
    topics: SUBSCRIPTION_EVENTS.PRESENCE_CHANGED,
    filter: ({
      payload,
      context,
    }: {
      payload: PresenceUpdatePayload;
      context: Context;
    }) => {
      // Only send presence updates for users in the same conversations
      return true; // TODO: Implement proper filtering based on shared conversations
    },
  })
  async presenceChanged(
    @Root() payload: PresenceUpdatePayload,
    @Ctx() ctx: Context
  ): Promise<UserPresence> {
    return payload.presence;
  }

  // Broadcast endpoints
  @Query(() => PaginatedBroadcastMessagesResponse)
  @UseMiddleware(AuthMiddleware)
  async getBroadcastMessages(
    @Arg("filters", { nullable: true }) filters: BroadcastMessageFilter,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedBroadcastMessagesResponse> {
    if (
      !ctx.user?.permissions.includes("SUPER_ADMIN") &&
      ctx.user?.role !== RoleEnum.ADMIN
    ) {
      throw new Error("Unauthorized: Only admins can view broadcast messages");
    }

    const where: Prisma.BroadcastMessageWhereInput = {};

    if (filters?.roles?.length) {
      where.recipientRoles = { hasSome: filters.roles };
    }

    if (filters?.search) {
      where.content = { contains: filters.search, mode: "insensitive" };
    }

    if (filters?.startDate && filters?.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate,
      };
    }

    const [broadcastMessages, totalCount] = await this.prisma.$transaction([
      this.prisma.broadcastMessage.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          sender: true,
          recipients: { select: { id: true } },
        },
      }),
      this.prisma.broadcastMessage.count({ where }),
    ]);

    const response = broadcastMessages.map(
      (msg: any) =>
        new BroadcastMessageResponse({
          ...msg,
          sentToUserIds: msg.recipients.map((r: { id: string }) => r.id),
        })
    );

    return new PaginatedBroadcastMessagesResponse(
      response,
      page,
      limit,
      totalCount
    );
  }

  @Query(() => BroadcastMessageResponse)
  @UseMiddleware(AuthMiddleware)
  async getBroadcastMessage(
    @Arg("broadcastId", () => ID) broadcastId: string,
    @Ctx() ctx: Context
  ): Promise<BroadcastMessageResponse> {
    // Ensure user has appropriate permissions or is a recipient
    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id: broadcastId },
      include: {
        sender: true,
        recipients: { select: { id: true } },
      },
    });

    if (!broadcast) {
      throw new Error("Broadcast message not found");
    }

    const isRecipient = broadcast.recipients.some(
      (r: { id: string }) => r.id === ctx.user!.id
    );
    const isAdmin =
      ctx.user?.permissions.includes("SUPER_ADMIN") ||
      ctx.user?.role === RoleEnum.ADMIN;

    if (!isRecipient && !isAdmin) {
      throw new Error("Unauthorized: You are not a recipient or admin");
    }

    return new BroadcastMessageResponse({
      ...broadcast,
      sentToUserIds: broadcast.recipients.map((r) => r.id),
    });
  }

  @Mutation(() => BroadcastMessageResponse)
  @UseMiddleware(AuthMiddleware)
  async sendBroadcastMessage(
    @Arg("input") input: BroadcastMessageInput,
    @Ctx() ctx: Context
  ): Promise<BroadcastMessageResponse> {
    // Ensure user has appropriate permissions
    if (
      !ctx.user?.permissions.includes("SUPER_ADMIN") &&
      ctx.user?.role !== RoleEnum.ADMIN
    ) {
      throw new Error("Unauthorized: Only admins can send broadcast messages");
    }

    const recipients = await this.prisma.user.findMany({
      where: { role: { in: input.recipientRoles } },
      select: { id: true },
    });

    const broadcast = await this.prisma.broadcastMessage.create({
      data: {
        content: input.content,
        messageType: input.messageType,
        senderId: ctx.user!.id,
        recipientRoles: input.recipientRoles,
        recipients: {
          connect: recipients.map((r: { id: string }) => ({ id: r.id })),
        },
        totalRecipients: recipients.length,
        attachments: input.attachments || [],
      },
      include: {
        sender: true,
        recipients: { select: { id: true } },
      },
    });

    // Publish to subscribers
    await (pubSub as any).publish(SUBSCRIPTION_EVENTS.BROADCAST_MESSAGE_SENT, {
      broadcastMessage: {
        ...broadcast,
        sentToUserIds: broadcast.recipients.map((r: { id: string }) => r.id),
      },
    });

    return new BroadcastMessageResponse({
      ...broadcast,
      sentToUserIds: broadcast.recipients.map((r) => r.id),
    });
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteBroadcastMessage(
    @Arg("broadcastId", () => ID) broadcastId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    // Ensure user has appropriate permissions
    if (
      !ctx.user?.permissions.includes("SUPER_ADMIN") &&
      ctx.user?.role !== RoleEnum.ADMIN
    ) {
      throw new Error(
        "Unauthorized: Only admins can delete broadcast messages"
      );
    }

    const broadcast = await this.prisma.broadcastMessage.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      throw new Error("Broadcast message not found");
    }

    await this.prisma.broadcastMessage.delete({
      where: { id: broadcastId },
    });

    return true;
  }

  @Subscription(() => BroadcastMessageResponse, {
    topics: SUBSCRIPTION_EVENTS.BROADCAST_MESSAGE_SENT,
    filter: ({
      payload,
      context,
    }: {
      payload: { broadcastMessage: BroadcastMessageResponse };
      context: Context;
    }) => {
      return payload.broadcastMessage.sentToUserIds.includes(
        context.user?.id ?? ""
      );
    },
  })
  async broadcastMessageSent(
    @Root() payload: { broadcastMessage: BroadcastMessageResponse },
    @Ctx() ctx: Context
  ): Promise<BroadcastMessageResponse> {
    return payload.broadcastMessage;
  }
}

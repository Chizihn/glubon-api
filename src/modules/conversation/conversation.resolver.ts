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
  ArgsType,
  Field,
} from "type-graphql";
import type { Context } from "../../types/context";
import { getContainer } from "../../services";
import { AuthMiddleware } from "../../middleware";
import { SUBSCRIPTION_EVENTS } from "../../utils/pubsub";
import {
  ConversationResponse,
  MarkAsReadResponse,
  MessageResponse,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  UnreadCountResponse,
  MessageSentPayload,
  PaginatedBroadcastMessagesResponse,
  BroadcastMessageResponse,
} from "./conversation.types";
import { MessageType, RoleEnum, Prisma, PrismaClient } from "@prisma/client";
import { ConversationService } from "../../services/conversation";
import { BroadcastMessageInput, BroadcastMessageFilter } from "./broadcast.inputs";
import { PubSub } from "graphql-subscriptions";
import {
  ConversationFilters,
  MessageFilters,
  SendMessageInput,
} from "./conversation.inputs";

@Resolver()
export class ConversationResolver {
  private conversationService: ConversationService;
  private prisma: PrismaClient;

  constructor() {
        const container = getContainer();
    
    this.conversationService = container.resolve('conversationService');
    this.prisma = container.getPrisma() as unknown as PrismaClient;
  }



  @Query(() => PaginatedConversationsResponse)
  @UseMiddleware(AuthMiddleware)
  async getConversations(
    @Arg("filters") filters: ConversationFilters,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedConversationsResponse> {
    const result = await this.conversationService.getConversations(
      { ...filters, userId: ctx.user!.id },
      page,
      limit
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return new PaginatedConversationsResponse(
      result.data.conversations,
      page,
      limit,
      result.data.totalCount
    );
  }

  @Query(() => ConversationResponse)
  @UseMiddleware(AuthMiddleware)
  async getConversation(
    @Arg("conversationId") conversationId: string,
    @Ctx() ctx: Context
  ): Promise<ConversationResponse> {
    const result = await this.conversationService.getConversationById(
      conversationId,
      ctx.user!.id
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedMessagesResponse)
  @UseMiddleware(AuthMiddleware)
  async getMessages(
    @Arg("conversationId", () => ID) conversationId: string,
    @Arg("filters", () => MessageFilters, {nullable: true}) filters: MessageFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedMessagesResponse> {
    const result = await this.conversationService.getMessages(
      { ...filters, conversationId },
      page,
      limit
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return new PaginatedMessagesResponse(
      result.data.messages as MessageResponse[],
      page,
      limit,
      result.data.totalCount
    );
  }

  @Mutation(() => MessageResponse)
  @UseMiddleware(AuthMiddleware)
  async sendMessage(
    @Arg("input") input: SendMessageInput,
    @Ctx() ctx: Context
  ): Promise<MessageResponse> {
    // Ensure either conversationId or recipientIds is provided
    if (!input.conversationId && (!input.recipientIds || input.recipientIds.length === 0)) {
      throw new Error("Either conversationId or recipientIds must be provided");
    }

    const result = await this.conversationService.sendMessage(
      ctx.user!.id,
      input
    );
    
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Mutation(() => MarkAsReadResponse)
  @UseMiddleware(AuthMiddleware)
  async markMessagesAsRead(
    @Arg("conversationId") conversationId: string,
    @Ctx() ctx: Context
  ): Promise<MarkAsReadResponse> {
    const result = await this.conversationService.markMessagesAsRead(
      conversationId,
      ctx.user!.id
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteMessage(
    @Arg("messageId") messageId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.conversationService.deleteMessage(
      messageId,
      ctx.user!.id
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async archiveConversation(
    @Arg("conversationId") conversationId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    const result = await this.conversationService.archiveConversation(
      conversationId,
      ctx.user!.id
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return true;
  }

  @Query(() => UnreadCountResponse)
  @UseMiddleware(AuthMiddleware)
  async getUnreadMessageCount(
    @Ctx() ctx: Context
  ): Promise<UnreadCountResponse> {
    const result = await this.conversationService.getUnreadMessageCount(
      ctx.user!.id
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedMessagesResponse)
  @UseMiddleware(AuthMiddleware)
  async searchMessages(
    @Arg("conversationId") conversationId: string,
    @Arg("query") query: string,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedMessagesResponse> {
    const result = await this.conversationService.searchMessages(
      conversationId,
      ctx.user!.id,
      query,
      page,
      limit
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return new PaginatedMessagesResponse(
      result.data.messages as MessageResponse[],
      page,
      limit,
      result.data.totalCount
    );
  }

  @Subscription(() => MessageResponse, {
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
  ): Promise<MessageResponse> {
    return payload.message;
  }

  @Subscription(() => MessageResponse, {
    topics: SUBSCRIPTION_EVENTS.MESSAGE_SENT,
    filter: ({
      payload,
      args,
    }: {
      payload: MessageSentPayload;
      args: { conversationId: string };
    }) => {
      return payload.conversationId === args.conversationId;
    },
  })
  async conversationMessages(
    @Arg("conversationId") conversationId: string,
    @Root() payload: MessageSentPayload
  ): Promise<MessageResponse> {
    return payload.message;
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
    if (!ctx.user?.permissions.includes("SUPER_ADMIN") && ctx.user?.role !== RoleEnum.ADMIN) {
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

    return new PaginatedBroadcastMessagesResponse(response, page, limit, totalCount);
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

    const isRecipient = broadcast.recipients.some((r: { id: string }) => r.id === ctx.user!.id);
    const isAdmin = ctx.user?.permissions.includes("SUPER_ADMIN") || ctx.user?.role === RoleEnum.ADMIN;

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
    if (!ctx.user?.permissions.includes("SUPER_ADMIN") && ctx.user?.role !== RoleEnum.ADMIN) {
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
    const pubSub = new PubSub();
    await pubSub.publish(SUBSCRIPTION_EVENTS.BROADCAST_MESSAGE_SENT, {
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
    if (!ctx.user?.permissions.includes("SUPER_ADMIN") && ctx.user?.role !== RoleEnum.ADMIN) {
      throw new Error("Unauthorized: Only admins can delete broadcast messages");
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
      return payload.broadcastMessage.sentToUserIds.includes(context.user?.id ?? "");
    },
  })
  async broadcastMessageSent(
    @Root() payload: { broadcastMessage: BroadcastMessageResponse },
    @Ctx() ctx: Context
  ): Promise<BroadcastMessageResponse> {
    return payload.broadcastMessage;
  }
}




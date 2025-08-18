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
import type { Context } from "../../types/context";
import { prisma } from "../../config/database";
import redis from "../../config/redis";
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
} from "./conversation.types";
import { ConversationService } from "../../services/conversation";
import {
  ConversationFilters,
  MessageFilters,
  SendMessageInput,
} from "./conversation.inputs";

@Resolver()
export class ChatResolver {
  private conversationService: ConversationService;

  constructor() {
    this.conversationService = new ConversationService(prisma, redis);
  }

  // Removed createConversation mutation as it's now handled internally by sendMessage

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
}

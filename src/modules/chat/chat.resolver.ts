import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  UseMiddleware,
  Arg,
  Ctx,
  Root,
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
} from "./chat.types";
import { ChatService } from "../../services/chat";
import {
  ConversationFilters,
  CreateConversationInput,
  MessageFilters,
  SendMessageInput,
} from "./chat.inputs";

@Resolver()
export class ChatResolver {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService(prisma, redis);
  }

  @Mutation(() => ConversationResponse)
  @UseMiddleware(AuthMiddleware)
  async createConversation(
    @Arg("input") input: CreateConversationInput,
    @Ctx() ctx: Context
  ): Promise<ConversationResponse> {
    const result = await this.chatService.createConversation(input);
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return result.data;
  }

  @Query(() => PaginatedConversationsResponse)
  @UseMiddleware(AuthMiddleware)
  async getConversations(
    @Arg("filters") filters: ConversationFilters,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedConversationsResponse> {
    const result = await this.chatService.getConversations(
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
    const result = await this.chatService.getConversationById(
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
    @Arg("conversationId") conversationId: string,
    @Arg("filters") filters: MessageFilters,
    @Arg("page", { defaultValue: 1 }) page: number,
    @Arg("limit", { defaultValue: 50 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedMessagesResponse> {
    const result = await this.chatService.getMessages(
      { ...filters, conversationId },
      page,
      limit
    );
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }
    return new PaginatedMessagesResponse(
      result.data.messages as MessageResponse[], // Type assertion to ensure compatibility
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
    const result = await this.chatService.sendMessage(ctx.user!.id, input);
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
    const result = await this.chatService.markMessagesAsRead(
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
    const result = await this.chatService.deleteMessage(
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
    const result = await this.chatService.archiveConversation(
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
    const result = await this.chatService.getUnreadMessageCount(ctx.user!.id);
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
    const result = await this.chatService.searchMessages(
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
      result.data.messages as MessageResponse[], // Type assertion to ensure compatibility
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
      return payload.recipientId === context.user?.id;
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

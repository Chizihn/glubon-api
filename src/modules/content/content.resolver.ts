import { Resolver, Query, Mutation, Subscription, Arg, Ctx, Int, ID, UseMiddleware, Root } from "type-graphql";
import { RedisPubSub } from "graphql-redis-subscriptions";
import {
  Content,
  ContentResponse,
  ContentListResponseData,
  ContentStatsResponse,
  ContentVersionHistoryResponse,
  CommentResponse,
  CommentListResponseData,
  ContentDisputeResponse,
  ContentDisputeListResponseData,
  ContentCreatedPayload,
  ContentStatusChangedPayload,
  Comment
} from "./content.types";
import {
  ContentFilterInput,
  CreateContentInput,
  UpdateContentInput,
  ContentStatusInput,
  ContentVersionInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateContentDisputeInput,
  UpdateContentDisputeInput
} from "./content.inputs";
import { ContentFilters, ContentService } from "../../services/content";
import { prisma, redis } from "../../config";
import { AuthMiddleware, RequireRole } from "../../middleware";
import { Context } from "../../types";
import { SUBSCRIPTION_EVENTS } from "../../utils";
import { RoleEnum } from "@prisma/client";

@Resolver(() => Content)
export class ContentResolver {
  private contentService: ContentService;

  constructor() {
    this.contentService = new ContentService(prisma, redis);
  }

  @Query(() => ContentResponse)
  @UseMiddleware(AuthMiddleware)
  async content(@Arg("id", () => ID) id: string, @Ctx() ctx: Context): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.getContentById(id, ctx.user.id, ctx.user.role === "ADMIN");
  }

  @Query(() => ContentResponse)
  async contentBySlug(@Arg("slug") slug: string): Promise<ContentResponse> {
    return this.contentService.getContentBySlug(slug);
  }

  @Query(() => ContentListResponseData)
  @UseMiddleware(AuthMiddleware)
  async contents(
    @Ctx() ctx: Context,
    @Arg("filters", () => ContentFilterInput, { nullable: true }) filters: Omit<ContentFilterInput, 'page' | 'limit'> & { page?: number; limit?: number } = { page: 1, limit: 10 }
  ): Promise<ContentListResponseData> {
    if (!ctx.user) throw new Error("Authentication required");

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    try {
      const filtersForService: ContentFilters = {
        types: filters.types ?? [],
        statuses: filters.statuses ?? [],
        category: filters.category ?? "",
        tags: filters.tags ?? [],
        search: filters.search ?? "",
        includeArchived: filters.includeArchived ?? false,
        page,
        limit,
        userId: ctx.user.id,
        isAdmin: ctx.user.role === "ADMIN",
      };

      return await this.contentService.getContents(filtersForService, ctx.user.id, ctx.user.role === "ADMIN");
    } catch (error) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
  }

  @Query(() => ContentStatsResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN,)])
  async contentStats(@Ctx() ctx: Context): Promise<ContentStatsResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.getContentStats(ctx.user.id, ctx.user.role === "ADMIN");
  }

  @Query(() => ContentVersionHistoryResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN, RoleEnum.LISTER)])
  async contentVersions(
    @Arg("contentId", () => ID) contentId: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<ContentVersionHistoryResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.getContentVersions(contentId, page, limit);
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN, RoleEnum.LISTER)])
  async createContent(
    @Arg("input") input: CreateContentInput,
    @Ctx() ctx: Context
  ): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");

    const contentData = {
      ...input,
      status: ctx.user.role === "ADMIN" ? input.status || "DRAFT" : "DRAFT",
      authorId: ctx.user.id,
    } as const;

    return this.contentService.createContent(contentData);
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async updateContent(
    @Arg("id", () => ID) id: string,
    @Arg("input") input: UpdateContentInput,
    @Ctx() ctx: Context
  ): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");

    const updateData: Omit<UpdateContentInput, 'updatedById'> & { updatedById: string } = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.slug && { slug: input.slug }),
      ...(input.content && { content: input.content }),
      ...(input.excerpt && { excerpt: input.excerpt }),
      ...(input.type && { type: input.type }),
      ...(input.status && { status: input.status }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.tags && { tags: input.tags }),
      ...(input.metadata && { metadata: input.metadata }),
      ...(input.featuredImage !== undefined && { featuredImage: input.featuredImage }),
      ...(input.featuredImageAlt !== undefined && { featuredImageAlt: input.featuredImageAlt }),
      ...(input.seoTitle !== undefined && { seoTitle: input.seoTitle }),
      ...(input.seoDescription !== undefined && { seoDescription: input.seoDescription }),
      ...(input.seoKeywords && { seoKeywords: input.seoKeywords }),
      ...(input.allowComments !== undefined && { allowComments: input.allowComments }),
      updatedById: ctx.user.id,
    };

    return this.contentService.updateContent(
      id,
      updateData,
      ctx.user.id,
      ctx.user.role === "ADMIN"
    );
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async updateContentStatus(
    @Arg("input") input: ContentStatusInput,
    @Ctx() ctx: Context
  ): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.updateContent(input.contentId, {
      status: input.status,
      updatedById: ctx.user.id,
    }, ctx.user.id, true);
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async restoreContentVersion(
    @Arg("input") input: ContentVersionInput,
    @Ctx() ctx: Context
  ): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.restoreContentVersion(input.contentId, input.version, ctx.user.id, ctx.user.role === "ADMIN");
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async deleteContent(@Arg("id", () => ID) id: string, @Ctx() ctx: Context): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.deleteContent(id, ctx.user.id, ctx.user.role === "ADMIN");
  }

  @Mutation(() => ContentResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async permanentlyDeleteContent(@Arg("id", () => ID) id: string, @Ctx() ctx: Context): Promise<ContentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.permanentlyDeleteContent(id, ctx.user.id);
  }

  @Mutation(() => CommentResponse)
  @UseMiddleware(AuthMiddleware)
  async createComment(@Arg("input") input: CreateCommentInput, @Ctx() ctx: Context): Promise<CommentResponse> {
    if (!ctx.user) throw new Error("Authentication required");

    const comment = await this.contentService.createComment({
      contentId: input.contentId,
      text: input.text,
      ...(input.parentId && { parentId: input.parentId }),
      userId: ctx.user.id,
    });

    return {
      data: comment.data as Comment,
      success: true,
      message: 'Comment created successfully',
    };
  }

  @Mutation(() => CommentResponse)
  @UseMiddleware(AuthMiddleware)
  async updateComment(@Arg("input") input: UpdateCommentInput, @Ctx() ctx: Context): Promise<CommentResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.updateComment(
      input.id, 
      { 
        id: input.id,
        text: input.text
      }, 
      ctx.user.id, 
      ctx.user.role === "ADMIN"
    );
  }

  @Query(() => CommentListResponseData)
  @UseMiddleware(AuthMiddleware)
  async comments(
    @Arg("contentId", () => ID) contentId: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<CommentListResponseData> {
    if (!ctx.user) throw new Error("Authentication required");

    try {
      return await this.contentService.getComments(contentId, page, limit);
    } catch (error) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
  }

  @Mutation(() => ContentDisputeResponse)
  @UseMiddleware(AuthMiddleware)
  async createContentDispute(@Arg("input") input: CreateContentDisputeInput, @Ctx() ctx: Context): Promise<ContentDisputeResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    return this.contentService.createContentDispute({
      contentId: input.contentId,
      title: input.title,
      description: input.description,
      type: input.type,
      evidence: input.evidence || '{}',
      reportedById: ctx.user.id,
    });
  }

  @Mutation(() => ContentDisputeResponse)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN)])
  async updateContentDispute(
    @Arg("id", () => ID) id: string,
    @Arg("input") input: UpdateContentDisputeInput,
    @Ctx() ctx: Context
  ): Promise<ContentDisputeResponse> {
    if (!ctx.user) throw new Error("Authentication required");
    
    const updateData: UpdateContentDisputeInput = {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.resolution !== undefined && { resolution: input.resolution }),
      ...(input.evidence !== undefined && { evidence: input.evidence })
    };
    
    return this.contentService.updateContentDispute(
      id,
      updateData,
      ctx.user.id, 
      ctx.user.role === "ADMIN"
    );
  }

  @Query(() => ContentDisputeListResponseData)
  @UseMiddleware([AuthMiddleware, RequireRole(RoleEnum.ADMIN,)])
  async contentDisputes(
    @Arg("contentId", () => ID) contentId: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<ContentDisputeListResponseData> {
    if (!ctx.user) throw new Error("Authentication required");

    try {
      return await this.contentService.getContentDisputes(contentId, page, limit);
    } catch (error) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
  }

  @Subscription(() => ContentResponse, {
    topics: SUBSCRIPTION_EVENTS.CONTENT_CREATED,
    filter: ({
      payload,
      context,
    }: {
      payload: ContentCreatedPayload;
      context: Context;
    }) => {
      return payload.userId === context.user?.id;
    },
  })
  async contentCreated(
    @Root() payload: ContentCreatedPayload
  ): Promise<ContentResponse> {
    return {
      success: true,
      message: 'Content created',
      data: payload.content,
      errors: [],
    };
  }

  @Subscription(() => ContentResponse, {
    topics: SUBSCRIPTION_EVENTS.CONTENT_STATUS_CHANGED,
    filter: ({
      payload,
      context,
    }: {
      payload: ContentStatusChangedPayload;
      context: Context;
    }) => {
      return payload.userId === context.user?.id;
    },
  })
  async contentStatusChanged(
    @Root() payload: ContentStatusChangedPayload
  ): Promise<ContentResponse> {
    return {
      success: true,
      message: 'Content status changed',
      data: payload.content,
      errors: [],
    };
  }
}
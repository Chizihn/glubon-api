import {
  PrismaClient,
  Content,
  ContentVersion,
  Comment,
  ContentDispute,
  ContentType as ContentTypePrisma,
  ContentStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { BaseService } from "./base";
import { ContentRepository } from "../repository/content";
import {
  Content as GQLContent,
  ContentVersion as GQLContentVersion,
  ContentListResponseData,
  ContentStats,
  Comment as GQLComment,
  ContentDispute as GQLContentDispute,
  ContentAuthor,
  ContentResponse,
  ContentStatsResponse,
  ContentVersionHistoryResponse,
  CommentResponse,
  CommentListResponseData,
  ContentDisputeResponse,
  ContentDisputeListResponseData,
  ContentVersionHistory,
} from "../modules/content/content.types";
import { logger, pubSub } from "../utils";
import { CreateCommentInput, CreateContentDisputeInput, CreateContentInput, UpdateCommentInput, UpdateContentDisputeInput, UpdateContentInput } from "../modules/content";

// Interface for content filters
export interface ContentFilters {
  types?: ContentTypePrisma[];
  statuses?: ContentStatus[];
  category?: string;
  tags?: string[];
  search?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
  userId?: string;
  isAdmin?: boolean;
}

export class ContentService extends BaseService {
  private repository: ContentRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.repository = new ContentRepository(prisma, redis);
  }

  private mapToContentType(content: Content & { author?: any; updatedBy?: any; versions?: any[]; comments?: any[]; disputes?: any[] }): GQLContent {
    if (!content) {
      throw new Error("Content is required");
    }

    // Create base content object with required fields
    const result: Omit<GQLContent, 'publishedAt' | 'deletedAt' | 'updatedBy' | 'metadata' | 'featuredImage' | 'featuredImageAlt' | 'seoTitle' | 'seoDescription' | 'category'> & {
      publishedAt?: Date;
      deletedAt?: Date;
      updatedBy?: ContentAuthor;
      metadata?: any;
      featuredImage?: string;
      featuredImageAlt?: string;
      seoTitle?: string;
      seoDescription?: string;
      category?: string;
    } = {
      id: content.id,
      title: content.title ?? "",
      slug: content.slug ?? "",
      content: content.content ?? "",
      excerpt: content.excerpt ?? "",
      type: content.type as ContentTypePrisma,
      status: content.status as ContentStatus,
      tags: content.tags ?? [],
      featured: content.featured ?? false,
      seoKeywords: content.seoKeywords ?? [],
      allowComments: content.allowComments ?? true,
      viewCount: content.viewCount ?? 0,
      author: {
        id: content.author?.id ?? "",
        firstName: content.author?.firstName ?? "",
        lastName: content.author?.lastName ?? "",
        email: content.author?.email ?? "",
        profilePic: content.author?.profilePic ?? undefined,
      },
      versions: content.versions?.map((v) => this.mapToContentVersion(v)) ?? [],
      comments: content.comments?.map((c) => this.mapToComment(c)) ?? [],
      disputes: content.disputes?.map((d) => this.mapToContentDispute(d)) ?? [],
      createdAt: new Date(content.createdAt),
      updatedAt: new Date(content.updatedAt),
      version: content.version ?? 1,
    };

    // Add optional fields if they exist
    if (content.publishedAt) result.publishedAt = new Date(content.publishedAt);
    if (content.deletedAt) result.deletedAt = new Date(content.deletedAt);
    if (content.updatedBy) {
      result.updatedBy = {
        id: content.updatedBy.id ?? "",
        firstName: content.updatedBy.firstName ?? "",
        lastName: content.updatedBy.lastName ?? "",
        email: content.updatedBy.email ?? "",
        profilePic: content.updatedBy.profilePic ?? undefined,
      };
    }
    if (content.metadata) result.metadata = content.metadata;
    if (content.featuredImage) result.featuredImage = content.featuredImage;
    if (content.featuredImageAlt) result.featuredImageAlt = content.featuredImageAlt;
    if (content.seoTitle) result.seoTitle = content.seoTitle;
    if (content.seoDescription) result.seoDescription = content.seoDescription;
    if (content.category) result.category = content.category;

    return result as GQLContent;
  }

  private mapToContentVersion(version: ContentVersion & { updatedBy?: any | null }): GQLContentVersion {
    if (!version) {
      throw new Error("Version is required");
    }

    // Create base version object with required fields
    const result: Omit<GQLContentVersion, 'updatedBy' | 'metadata' | 'deletedAt'> & {
      updatedBy?: ContentAuthor;
      metadata?: any;
      deletedAt?: Date;
    } = {
      id: version.id,
      version: version.version ?? 1,
      title: version.title ?? "",
      content: version.contentText ?? "",
      excerpt: version.excerpt ?? "",
      type: version.type as ContentTypePrisma,
      status: version.status as ContentStatus,
      updatedAt: new Date(version.updatedAt),
    };

    // Add optional fields if they exist
    if (version.updatedBy) {
      result.updatedBy = {
        id: version.updatedBy.id ?? "",
        firstName: version.updatedBy.firstName ?? "",
        lastName: version.updatedBy.lastName ?? "",
        email: version.updatedBy.email ?? "",
        profilePic: version.updatedBy.profilePic ?? undefined,
      };
    }
    if (version.metadata) result.metadata = version.metadata;
    if (version.deletedAt) result.deletedAt = new Date(version.deletedAt);

    return result as GQLContentVersion;
  }

  private mapToComment(comment: Comment & { user?: any; replies?: any[] }): GQLComment {
    if (!comment) {
      throw new Error("Comment is required");
    }

    // Create base comment object with required fields
    const result: Omit<GQLComment, 'parentId' | 'replies'> & {
      parentId?: string;
      replies: GQLComment[];
    } = {
      id: comment.id ?? "",
      contentId: comment.contentId ?? "",
      text: comment.text ?? "",
      user: {
        id: comment.user?.id ?? "",
        firstName: comment.user?.firstName ?? "",
        lastName: comment.user?.lastName ?? "",
        email: comment.user?.email ?? "",
        profilePic: comment.user?.profilePic ?? undefined,
      },
      replies: comment.replies?.map((r) => this.mapToComment(r)) ?? [],
      createdAt: new Date(comment.createdAt),
      updatedAt: new Date(comment.updatedAt),
    };

    // Add optional parentId if it exists
    if (comment.parentId) {
      result.parentId = comment.parentId;
    }

    return result as GQLComment;
  }

  private mapToContentDispute(
    dispute: ContentDispute & {
      reportedBy: any;
      assignedTo?: any;
      resolvedBy?: any;
      content?: any;
    },
  ): GQLContentDispute {
    if (!dispute || !dispute.reportedBy) {
      throw new Error("Dispute and reportedBy are required");
    }

    // Create base dispute object with required fields
    const result: Omit<GQLContentDispute, 'assignedTo' | 'resolvedBy' | 'content' | 'evidence' | 'resolution' | 'resolvedAt' | 'contentId'> & {
      assignedTo?: ContentAuthor;
      resolvedBy?: ContentAuthor;
      content?: GQLContent;
      evidence?: any;
      resolution?: string;
      resolvedAt?: Date;
      contentId?: string;
    } = {
      id: dispute.id,
      title: dispute.title ?? "",
      description: dispute.description ?? "",
      type: dispute.type,
      status: dispute.status,
      reportedBy: {
        id: dispute.reportedBy.id ?? "",
        firstName: dispute.reportedBy.firstName ?? "",
        lastName: dispute.reportedBy.lastName ?? "",
        email: dispute.reportedBy.email ?? "",
        profilePic: dispute.reportedBy.profilePic ?? undefined,
      },
      createdAt: new Date(dispute.createdAt),
      updatedAt: new Date(dispute.updatedAt),
    };

    // Add optional fields if they exist
    if (dispute.assignedTo) {
      result.assignedTo = {
        id: dispute.assignedTo.id ?? "",
        firstName: dispute.assignedTo.firstName ?? "",
        lastName: dispute.assignedTo.lastName ?? "",
        email: dispute.assignedTo.email ?? "",
        profilePic: dispute.assignedTo.profilePic ?? undefined,
      };
    }

    if (dispute.resolvedBy) {
      result.resolvedBy = {
        id: dispute.resolvedBy.id ?? "",
        firstName: dispute.resolvedBy.firstName ?? "",
        lastName: dispute.resolvedBy.lastName ?? "",
        email: dispute.resolvedBy.email ?? "",
        profilePic: dispute.resolvedBy.profilePic ?? undefined,
      };
    }

    if (dispute.content) result.content = this.mapToContentType(dispute.content);
    if (dispute.resolvedAt) result.resolvedAt = new Date(dispute.resolvedAt);
    if (dispute.evidence) result.evidence = JSON.parse(JSON.stringify(dispute.evidence));
    if (dispute.contentId) result.contentId = dispute.contentId;
    if (dispute.resolution) result.resolution = dispute.resolution;

    return result as GQLContentDispute;
  }

  async getContentById(id: string, userId: string, isAdmin: boolean): Promise<ContentResponse> {
    try {
      const cacheKey = this.generateCacheKey("content", id);
      const cached = await this.getCache<GQLContent>(cacheKey);
      if (cached) return this.success(cached, "Content retrieved from cache");

      const content = await this.repository.findContentById(id);
      if (!content || content.deletedAt) {
        return this.failure("Content not found");
      }
      if (!isAdmin && content.status !== "PUBLISHED" && content.authorId !== userId) {
        return this.failure("Not authorized to view this content");
      }

      const mappedContent = this.mapToContentType(content);
      await this.setCache(cacheKey, mappedContent, 3600);
      return this.success(mappedContent, "Content retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getContentById");
    }
  }

  async getContentBySlug(slug: string): Promise<ContentResponse> {
    try {
      const cacheKey = this.generateCacheKey("content:slug", slug);
      const cached = await this.getCache<GQLContent>(cacheKey);
      if (cached) return this.success(cached, "Content retrieved from cache");

      const content = await this.repository.findContentBySlug(slug);
      if (!content) {
        return this.failure("Content not found");
      }

      const mappedContent = this.mapToContentType(content);
      await this.setCache(cacheKey, mappedContent, 3600);
      return this.success(mappedContent, "Content retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getContentBySlug");
    }
  }

  async getContents(filters: ContentFilters, userId: string, isAdmin: boolean): Promise<ContentListResponseData> {
    try {
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 10;
      const cacheKey = this.generateCacheKey("contents", JSON.stringify(filters), userId, String(isAdmin));
      const cached = await this.getCache<ContentListResponseData>(cacheKey);
      if (cached) return cached;

      const { items, total } = await this.repository.getContents(
        { ...filters, userId, isAdmin },
        page,
        limit,
      );
      
      const { totalPages, hasNextPage, hasPreviousPage } = this.buildPagination(page, limit, total);
      
      const response: ContentListResponseData = {
        items: items.map((item) => this.mapToContentType(item)),
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };

      await this.setCache(cacheKey, response, 3600);
      return response;
    } catch (error) {
      // Return empty response on error with correct type
      return {
        items: [],
        total: 0,
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }
  }

  async getContentStats(userId: string, isAdmin: boolean): Promise<ContentStatsResponse> {
    try {
      const cacheKey = this.generateCacheKey("content:stats", userId, String(isAdmin));
      const cached = await this.getCache<ContentStats>(cacheKey);
      if (cached) return this.success(cached, "Content stats retrieved from cache");

      const stats = await this.repository.getContentStats(userId, isAdmin);
      const response: ContentStats = {
        total: stats.total,
        published: stats.published,
        draft: stats.draft,
        archived: stats.archived,
        scheduled: stats.scheduled,
        trash: stats.trash,
        pendingReview: stats.pendingReview,
        rejected: stats.rejected,
        recent: stats.recent.map((item) => this.mapToContentType(item)),
        popular: stats.popular.map((item) => this.mapToContentType(item)),
      };

      await this.setCache(cacheKey, response, 3600);
      return this.success(response, "Content stats retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getContentStats");
    }
  }

  async getContentVersions(contentId: string, page: number, limit: number): Promise<ContentVersionHistoryResponse> {
    try {
      const cacheKey = this.generateCacheKey("content:versions", contentId, String(page), String(limit));
      const cached = await this.getCache<ContentVersionHistory>(cacheKey);
      if (cached) return this.success(cached, "Content versions retrieved from cache");

      const { versions, total } = await this.repository.getContentVersions(contentId, page, limit);
      const response: ContentVersionHistory = {
        versions: versions.map((v) => this.mapToContentVersion(v)),
        total,
      };

      await this.setCache(cacheKey, response, 3600);
      return this.success(response, "Content versions retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getContentVersions");
    }
  }

  async getContentVersion(contentId: string, version: number): Promise<ContentVersionHistoryResponse> {
    try {
      const cacheKey = this.generateCacheKey("content:version", contentId, String(version));
      const cached = await this.getCache<GQLContentVersion>(cacheKey);
      if (cached) return this.success({ versions: [cached], total: 1 }, "Content version retrieved from cache");

      const contentVersion = await this.repository.findContentVersion(contentId, version);
      if (!contentVersion) {
        return this.failure("Content version not found");
      }

      const mappedVersion = this.mapToContentVersion(contentVersion);
      await this.setCache(cacheKey, mappedVersion, 3600);
      return this.success({ versions: [mappedVersion], total: 1 }, "Content version retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getContentVersion");
    }
  }

  async createContent(data: Omit<CreateContentInput, "authorId"> & { authorId: string }): Promise<ContentResponse> {
    try {
      const existingContent = await this.repository.findContentBySlug(data.slug);
      if (existingContent) {
        return this.failure("Slug already exists");
      }

      const content = await this.repository.createContent({
        ...data,
        status: data.status ?? ContentStatus.DRAFT,
        version: 1,
        tags: data.tags ?? [],
        seoKeywords: data.seoKeywords ?? [],
        authorId: data.authorId,
      });

      const mappedContent = this.mapToContentType(content);
      await (pubSub as RedisPubSub).publish("CONTENT_CREATED", {
        content: mappedContent,
        userId: data.authorId,
      });
      await this.deleteCachePattern("contents:*");
      return this.success(mappedContent, "Content created successfully");
    } catch (error) {
      return this.handleError(error, "createContent");
    }
  }

  async updateContent(
    id: string,
    data: Omit<UpdateContentInput, "updatedById"> & { updatedById: string },
    userId: string,
    isAdmin: boolean,
  ): Promise<ContentResponse> {
    try {
      const existingContent = await this.repository.findContentById(id);
      if (!existingContent || existingContent.deletedAt) {
        return this.failure("Content not found");
      }
      if (!isAdmin && existingContent.authorId !== userId) {
        return this.failure("Not authorized to update this content");
      }
      if (data.slug) {
        const slugExists = await this.repository.findContentBySlug(data.slug);
        if (slugExists && slugExists.id !== id) {
          return this.failure("Slug already exists");
        }
      }

      const shouldCreateVersion =
        (data.status && data.status !== existingContent.status) ||
        (data.content && data.content !== existingContent.content) ||
        (data.title && data.title !== existingContent.title) ||
        (data.excerpt !== undefined && data.excerpt !== existingContent.excerpt);

      const version = shouldCreateVersion ? (existingContent.version ?? 1) + 1 : existingContent.version ?? 1;

      if (shouldCreateVersion) {
        await this.repository.createContentVersion(id, {
          version,
          title: data.title ?? existingContent.title ?? "",
          contentText: data.content ?? existingContent.content ?? "",
          excerpt: data.excerpt ?? existingContent.excerpt ?? "",
          type: data.type ?? existingContent.type,
          status: data.status ?? existingContent.status,
          updatedById: userId,
          metadata: data.metadata ?? existingContent.metadata,
        });
      }

      const updatedContent = await this.repository.updateContent(id, {
        ...data,
        version,
        updatedById: userId,
      });

      if (data.status && data.status !== existingContent.status) {
        await (pubSub as RedisPubSub).publish("CONTENT_STATUS_CHANGED", {
          content: this.mapToContentType(updatedContent),
          userId,
        });
      }

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("contents:*");
      return this.success(this.mapToContentType(updatedContent), "Content updated successfully");
    } catch (error) {
      return this.handleError(error, "updateContent");
    }
  }

  async deleteContent(id: string, userId: string, isAdmin: boolean): Promise<ContentResponse> {
    try {
      const existingContent = await this.repository.findContentById(id);
      if (!existingContent || existingContent.deletedAt) {
        return this.failure("Content not found");
      }
      if (!isAdmin && existingContent.authorId !== userId) {
        return this.failure("Not authorized to delete this content");
      }

      const updatedContent = await this.repository.updateContent(id, {
        status: ContentStatus.TRASH,
        deletedAt: new Date(),
        updatedById: userId,
      });

      await (pubSub as RedisPubSub).publish("CONTENT_STATUS_CHANGED", {
        content: this.mapToContentType(updatedContent),
        userId,
      });
      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("contents:*");
      return this.success(this.mapToContentType(updatedContent), "Content deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteContent");
    }
  }

  async permanentlyDeleteContent(id: string, userId: string): Promise<ContentResponse> {
    try {
      const existingContent = await this.repository.findContentById(id);
      if (!existingContent || existingContent.deletedAt) {
        return this.failure("Content not found");
      }

      await this.prisma.content.delete({ where: { id } });
      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("contents:*");
      return this.success({} as GQLContent, "Content permanently deleted");
    } catch (error) {
      return this.handleError(error, "permanentlyDeleteContent");
    }
  }

  async restoreContentVersion(contentId: string, version: number, userId: string, isAdmin: boolean): Promise<ContentResponse> {
    try {
      const versionToRestore = await this.repository.findContentVersion(contentId, version);
      if (!versionToRestore) {
        return this.failure("Content version not found");
      }

      const response = await this.updateContent(
        contentId,
        {
          title: versionToRestore.title ?? "",
          content: versionToRestore.contentText ?? "",
          excerpt: versionToRestore.excerpt ?? "",
          type: versionToRestore.type,
          status: ContentStatus.DRAFT,
          updatedById: userId,
        },
        userId,
        isAdmin,
      );

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("contents:*");
      return response;
    } catch (error) {
      return this.handleError(error, "restoreContentVersion");
    }
  }

  async createComment(data: Omit<CreateCommentInput, "userId"> & { userId: string }): Promise<CommentResponse> {
    try {
      const content = await this.repository.findContentById(data.contentId);
      if (!content || content.deletedAt || !content.allowComments) {
        return this.failure("Cannot comment on this content");
      }

      const comment = await this.repository.createComment({
        contentId: data.contentId,
        userId: data.userId,
        text: data.text,
        parentId: data.parentId ?? null,
      });

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("comments:*");
      return this.success(this.mapToComment(comment), "Comment created successfully");
    } catch (error) {
      return this.handleError(error, "createComment");
    }
  }

  async updateComment(id: string, data: UpdateCommentInput, userId: string, isAdmin: boolean): Promise<CommentResponse> {
    try {
      const comment = await this.repository.findCommentById(id);
      if (!comment || comment.contentId) {
        return this.failure("Comment or associated content not found");
      }
      if (!isAdmin && comment.userId !== userId) {
        return this.failure("Not authorized to update this comment");
      }

      const updateData: Omit<UpdateCommentInput, 'id'> = {
        text: data.text,
      };
      
      const updatedComment = await this.repository.updateComment(id, updateData);

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("comments:*");
      return this.success(this.mapToComment(updatedComment), "Comment updated successfully");
    } catch (error) {
      return this.handleError(error, "updateComment");
    }
  }

  async deleteComment(id: string, userId: string, isAdmin: boolean): Promise<CommentResponse> {
    try {
      const comment = await this.repository.findCommentById(id);
      if (!comment || comment.contentId) {
        return this.failure("Comment or associated content not found");
      }
      if (!isAdmin && comment.userId !== userId) {
        return this.failure("Not authorized to delete this comment");
      }

      await this.repository.deleteComment(id);
      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("comments:*");
      return this.success({} as GQLComment, "Comment deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteComment");
    }
  }

  async getComments(contentId: string, page: number, limit: number): Promise<CommentListResponseData> {
    try {
      const cacheKey = this.generateCacheKey("comments", contentId, String(page), String(limit));
      const cached = await this.getCache<CommentListResponseData>(cacheKey);
      if (cached) return cached;

      const { items, total } = await this.repository.getComments(contentId, page, limit);
      const { totalPages, hasNextPage, hasPreviousPage } = this.buildPagination(page, limit, total);
      
      const response: CommentListResponseData = {
        items: items.map((item) => this.mapToComment(item)),
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };

      await this.setCache(cacheKey, response, 3600);
      return response;
    } catch (error) {
      // Return empty response on error with correct type
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

  async createContentDispute(
    data: Omit<CreateContentDisputeInput, "reportedById"> & { reportedById: string },
  ): Promise<ContentDisputeResponse> {
    try {
      const content = await this.repository.findContentById(data.contentId);
      if (!content || content.deletedAt) {
        return this.failure("Content not found");
      }

      // Create dispute with required fields from input
      const dispute = await this.repository.createContentDispute({
        contentId: data.contentId,
        reportedById: data.reportedById,
        title: data.title,
        description: data.description,
        type: data.type,
        // Default status to OPEN if not provided
        status: 'OPEN',
        // Only include evidence if provided
        evidence: data.evidence,
      });

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("disputes:*");
      return this.success(this.mapToContentDispute({ ...dispute, reportedBy: { id: data.reportedById } }), "Content dispute created successfully");
    } catch (error) {
      return this.handleError(error, "createContentDispute");
    }
  }

  async updateContentDispute(
    id: string,
    data: UpdateContentDisputeInput,
    userId: string,
    isAdmin: boolean,
  ): Promise<ContentDisputeResponse> {
    try {
      const dispute = await this.repository.findContentDisputeById(id);
      if (!dispute) {
        return this.failure("Dispute not found");
      }
      if (!isAdmin && dispute.reportedById !== userId) {
        return this.failure("Not authorized to update this dispute");
      }

      // Only include fields that are provided in the input
      const updateData: Partial<UpdateContentDisputeInput> = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type && { type: data.type }),
        ...(data.status && { status: data.status }),
        ...(data.evidence !== undefined && { evidence: data.evidence }),
        ...(data.resolution !== undefined && { resolution: data.resolution }),
      };

      const updatedDispute = await this.repository.updateContentDispute(id, updateData);

      await this.deleteCachePattern("content:*");
      await this.deleteCachePattern("disputes:*");
      return this.success(this.mapToContentDispute({ ...updatedDispute, reportedBy: { id: dispute.reportedById } }), "Content dispute updated successfully");
    } catch (error) {
      return this.handleError(error, "updateContentDispute");
    }
  }

  async getContentDisputes(contentId: string, page: number, limit: number): Promise<ContentDisputeListResponseData> {
    try {
      const cacheKey = this.generateCacheKey("disputes", contentId, String(page), String(limit));
      const cached = await this.getCache<ContentDisputeListResponseData>(cacheKey);
      if (cached) return cached;

      const { items, total } = await this.repository.getContentDisputes(contentId, page, limit);
      const { totalPages, hasNextPage, hasPreviousPage } = this.buildPagination(page, limit, total);
      
      const response: ContentDisputeListResponseData = {
        items: items.map((item: any) => this.mapToContentDispute({
          ...item,
          // Use the included relations or fall back to just the ID
          reportedBy: item.reportedBy || { id: item.reportedById },
          assignedTo: item.assignedToId ? { id: item.assignedToId } : undefined,
          resolvedBy: item.resolvedById ? { id: item.resolvedById } : undefined,
          // Ensure content is properly included if needed
          content: item.content ? this.mapToContentType(item.content) : undefined
        })),
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      };

      await this.setCache(cacheKey, response, 3600);
      return response;
    } catch (error) {
      // Handle the error and ensure we return the correct type
      const errorResponse = this.handleError(error, "getContentDisputes");
      // Return a properly structured empty response on error
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
}
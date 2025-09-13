import {
    PrismaClient,
    Content,
    ContentVersion,
    Comment,
    ContentDispute,
    ContentType,
    ContentStatus,
    DisputeType,
    DisputeStatus,
    Prisma,
  } from "@prisma/client";
  import { Redis } from "ioredis";
  import { BaseRepository } from "./base";
  
  // Input interfaces for type safety
  interface CreateContentInput {
    title: string;
    slug: string;
    content: string;
    excerpt?: string | null;
    type: ContentType;
    status: ContentStatus;
    category?: string | null;
    tags?: string[] | null;
    metadata?: any | null;
    featured?: boolean;
    featuredImage?: string | null;
    featuredImageAlt?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string[] | null;
    allowComments?: boolean;
    viewCount?: number;
    publishedAt?: Date | null;
    authorId: string;
    version?: number;
    deletedAt?: Date | null;
  }
  
  interface UpdateContentInput {
    title?: string;
    slug?: string;
    content?: string;
    excerpt?: string | null;
    type?: ContentType;
    status?: ContentStatus;
    category?: string | null;
    tags?: string[] | Prisma.ContentUpdatetagsInput;
    metadata?: any | null;
    featured?: boolean;
    featuredImage?: string | null;
    featuredImageAlt?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoKeywords?: string[] | Prisma.ContentUpdateseoKeywordsInput;
    allowComments?: boolean;
    viewCount?: number;
    publishedAt?: Date | null;
    updatedById: string;
    version?: number;
    deletedAt?: Date | null;
  }
  
  interface CreateContentVersionInput {
    version: number;
    title: string;
    contentText: string;
    excerpt?: string | null;
    type: ContentType;
    status: ContentStatus;
    metadata?: any | null;
    updatedById: string;
    deletedAt?: Date | null;
  }
  
  interface CreateCommentInput {
    contentId: string;
    userId: string;
    text: string;
    parentId?: string | null;
  }
  
  interface UpdateCommentInput {
    text?: string;
    parentId?: string | null;
  }
  
  interface CreateContentDisputeInput {
    contentId: string;
    reportedById: string;
    title: string;
    description: string;
    type: DisputeType;
    status: DisputeStatus;
    evidence?: any | null;
    resolution?: string | null;
    resolvedAt?: Date | null;
    assignedToId?: string | null;
    resolvedById?: string | null;
  }
  
  interface UpdateContentDisputeInput {
    title?: string;
    description?: string;
    type?: DisputeType | Prisma.EnumDisputeTypeFieldUpdateOperationsInput;
    status?: DisputeStatus | Prisma.EnumDisputeStatusFieldUpdateOperationsInput;
    evidence?: any | null;
    resolution?: string | null;
    resolvedAt?: Date | null;
    assignedToId?: string | null;
    resolvedById?: string | null;
  }
  
  export class ContentRepository extends BaseRepository {
    constructor(prisma: PrismaClient, redis: Redis) {
      super(prisma, redis);
    }
  
    async createContent(data: CreateContentInput): Promise<Content> {
      return this.prisma.content.create({
        data: {
          title: data.title,
          slug: data.slug,
          content: data.content,
          excerpt: data.excerpt ?? null,
          type: data.type,
          status: data.status,
          category: data.category ?? null,
          tags: data.tags ?? [],
          metadata: data.metadata ?? null,
          featured: data.featured ?? false,
          featuredImage: data.featuredImage ?? null,
          featuredImageAlt: data.featuredImageAlt ?? null,
          seoTitle: data.seoTitle ?? null,
          seoDescription: data.seoDescription ?? null,
          seoKeywords: data.seoKeywords ?? [],
          allowComments: data.allowComments ?? true,
          viewCount: data.viewCount ?? 0,
          publishedAt: data.publishedAt ?? null,
          authorId: data.authorId,
          updatedById: data.authorId,
          version: data.version ?? 1,
          deletedAt: data.deletedAt ?? null,
          versions: {
            create: {
              version: 1,
              title: data.title,
              contentText: data.content,
              excerpt: data.excerpt ?? null,
              type: data.type,
              status: data.status,
              updatedById: data.authorId,
              metadata: data.metadata ?? null,
            },
          },
        },
        include: {
          author: true,
          updatedBy: true,
          versions: { include: { updatedBy: true } },
          comments: { include: { user: true, replies: { include: { user: true } } } },
          disputes: { include: { reportedBy: true, assignedTo: true, resolvedBy: true } },
        },
      });
    }
  
    async updateContent(id: string, data: UpdateContentInput): Promise<Content> {
      const updateData: Prisma.ContentUpdateInput = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.featured !== undefined && { featured: data.featured }),
        ...(data.featuredImage !== undefined && { featuredImage: data.featuredImage }),
        ...(data.featuredImageAlt !== undefined && { featuredImageAlt: data.featuredImageAlt }),
        ...(data.seoTitle !== undefined && { seoTitle: data.seoTitle }),
        ...(data.seoDescription !== undefined && { seoDescription: data.seoDescription }),
        ...(data.seoKeywords !== undefined && { seoKeywords: data.seoKeywords }),
        ...(data.allowComments !== undefined && { allowComments: data.allowComments }),
        ...(data.viewCount !== undefined && { viewCount: data.viewCount }),
        ...(data.publishedAt !== undefined && { publishedAt: data.publishedAt }),
        ...(data.updatedById && { updatedBy: { connect: { id: data.updatedById } } }),
        ...(data.version !== undefined && { version: data.version }),
        ...(data.deletedAt !== undefined && { deletedAt: data.deletedAt })
      };

      return this.prisma.content.update({
        where: { id },
        data: updateData,
        include: {
          author: true,
          updatedBy: true,
          versions: { include: { updatedBy: true } },
          comments: { include: { user: true, replies: { include: { user: true } } } },
          disputes: { include: { reportedBy: true, assignedTo: true, resolvedBy: true } },
        },
      });
    }
  
    async createContentVersion(contentId: string, data: CreateContentVersionInput): Promise<ContentVersion> {
      return this.prisma.contentVersion.create({
        data: {
          contentId,
          version: data.version,
          title: data.title,
          contentText: data.contentText,
          excerpt: data.excerpt ?? null,
          type: data.type,
          status: data.status,
          metadata: data.metadata ?? null,
          updatedById: data.updatedById,
          deletedAt: data.deletedAt ?? null,
        },
        include: { updatedBy: true },
      });
    }
  
    async findContentById(id: string): Promise<Content | null> {
      return this.prisma.content.findUnique({
        where: { id },
        include: {
          author: true,
          updatedBy: true,
          versions: { include: { updatedBy: true } },
          comments: { include: { user: true, replies: { include: { user: true } } } },
          disputes: { include: { reportedBy: true, assignedTo: true, resolvedBy: true } },
        },
      });
    }
  
    async findContentBySlug(slug: string): Promise<Content | null> {
      return this.prisma.content.findFirst({
        where: { slug, status: "PUBLISHED", deletedAt: null },
        include: {
          author: true,
          updatedBy: true,
          versions: { include: { updatedBy: true } },
          comments: { include: { user: true, replies: { include: { user: true } } } },
          disputes: { include: { reportedBy: true, assignedTo: true, resolvedBy: true } },
        },
      });
    }
  
    async findContentVersion(contentId: string, version?: number): Promise<ContentVersion | null> {
      const query: Prisma.ContentVersionFindFirstArgs = {
        where: {
          contentId,
          ...(version !== undefined ? { version } : {}),
        },
        include: { updatedBy: true },
      };
      
      if (version === undefined) {
        query.orderBy = { version: 'desc' } as Prisma.ContentVersionOrderByWithRelationInput;
      }
      
      return this.prisma.contentVersion.findFirst(query);
    }
  
    async getContentVersions(contentId: string, page: number, limit: number): Promise<{ versions: ContentVersion[], total: number }> {
      const { skip, limit: validatedLimit } = this.validatePagination(page, limit);
      const [versions, total] = await Promise.all([
        this.prisma.contentVersion.findMany({
          where: { contentId },
          include: { updatedBy: true },
          orderBy: { version: 'desc' as const },
          skip,
          take: validatedLimit,
        }),
        this.prisma.contentVersion.count({ where: { contentId } }),
      ]);
      return { versions, total };
    }
  
    async getContents(
      filters: {
        types?: ContentType[];
        statuses?: ContentStatus[];
        category?: string;
        tags?: string[];
        search?: string;
        includeArchived?: boolean;
        userId?: string;
        isAdmin?: boolean;
      },
      page: number,
      limit: number,
    ): Promise<{ items: Content[], total: number }> {
      const where: Prisma.ContentWhereInput = { deletedAt: null };
  
      if (filters.types?.length) {
        where.type = { in: filters.types };
      }
  
      if (filters.statuses?.length) {
        where.status = { in: filters.statuses };
      } else if (!filters.includeArchived) {
        where.status = { notIn: ["ARCHIVED", "TRASH"] };
      }
  
      if (filters.category) {
        where.category = filters.category;
      }
  
      if (filters.tags?.length) {
        where.tags = { hasSome: filters.tags };
      }
  
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: "insensitive" } },
          { content: { contains: filters.search, mode: "insensitive" } },
          { excerpt: { contains: filters.search, mode: "insensitive" } },
        ];
      }
  
      if (!filters.isAdmin && filters.userId) {
        where.AND = [
          {
            OR: [{ status: "PUBLISHED" }, { authorId: filters.userId }],
          },
        ];
      }
  
      const { skip, limit: validatedLimit } = this.validatePagination(page, limit);
      const [items, total] = await Promise.all([
        this.prisma.content.findMany({
          where,
          include: {
            author: true,
            updatedBy: true,
            versions: { include: { updatedBy: true } },
            comments: { include: { user: true, replies: { include: { user: true } } } },
            disputes: { include: { reportedBy: true, assignedTo: true, resolvedBy: true } },
          },
          orderBy: { createdAt: 'desc' as const },
          skip,
          take: validatedLimit,
        }),
        this.prisma.content.count({ where }),
      ]);
  
      return { items, total };
    }
  
    async getContentStats(userId: string, isAdmin: boolean): Promise<{
      total: number;
      published: number;
      draft: number;
      archived: number;
      scheduled: number;
      trash: number;
      pendingReview: number;
      rejected: number;
      recent: Content[];
      popular: Content[];
    }> {
      const where: Prisma.ContentWhereInput = isAdmin
        ? {}
        : {
            OR: [{ status: "PUBLISHED" }, { authorId: userId }],
            deletedAt: null,
          };
  
      const [total, published, draft, archived, scheduled, trash, pendingReview, rejected, recent, popular] = await Promise.all([
        this.prisma.content.count({ where: { ...where, deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "PUBLISHED", deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "DRAFT", deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "ARCHIVED", deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "SCHEDULED", deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "TRASH" } }),
        this.prisma.content.count({ where: { ...where, status: "PENDING_REVIEW", deletedAt: null } }),
        this.prisma.content.count({ where: { ...where, status: "REJECTED", deletedAt: null } }),
        this.prisma.content.findMany({
          where: { ...where, deletedAt: null },
          orderBy: { createdAt: 'desc' as const },
          take: 5,
          include: { author: true, versions: { orderBy: { version: 'desc' as const }, take: 1 } },
        }),
        this.prisma.content.findMany({
          where: { ...where, deletedAt: null },
          orderBy: { viewCount: 'desc' as const },
          take: 5,
          include: { author: true, versions: { orderBy: { version: 'desc' as const }, take: 1 } },
        }),
      ]);
  
      return { total, published, draft, archived, scheduled, trash, pendingReview, rejected, recent, popular };
    }
  
    async createComment(data: CreateCommentInput): Promise<Comment> {
      return this.prisma.comment.create({
        data: {
          contentId: data.contentId,
          userId: data.userId,
          text: data.text,
          parentId: data.parentId ?? null,
        },
        include: { user: true, replies: { include: { user: true } } },
      });
    }
  
    async updateComment(id: string, data: UpdateCommentInput): Promise<Comment> {
      const updateData: Prisma.CommentUpdateInput = {
        ...(data.text !== undefined && { text: { set: data.text } }),
        ...(data.parentId !== undefined && { 
          parentId: data.parentId === null ? { set: null } : { set: data.parentId }
        }),
      };
      
      return this.prisma.comment.update({
        where: { id },
        data: updateData,
        include: { user: true, replies: { include: { user: true } } },
      });
    }
  
    async deleteComment(id: string): Promise<void> {
      await this.prisma.comment.delete({ where: { id } });
    }
  
    async getComments(contentId: string, page: number, limit: number): Promise<{ items: Comment[], total: number }> {
      const { skip, limit: validatedLimit } = this.validatePagination(page, limit);
      const [items, total] = await Promise.all([
        this.prisma.comment.findMany({
          where: { contentId, parentId: null },
          include: { user: true, replies: { include: { user: true } } },
          orderBy: { createdAt: 'desc' as const },
          skip,
          take: validatedLimit,
        }),
        this.prisma.comment.count({ where: { contentId, parentId: null } }),
      ]);
      return { items, total };
    }
  
    async createContentDispute(data: CreateContentDisputeInput): Promise<ContentDispute> {
      return this.prisma.contentDispute.create({
        data: {
          contentId: data.contentId,
          reportedById: data.reportedById,
          title: data.title,
          description: data.description,
          type: data.type,
          status: data.status,
          evidence: data.evidence ?? null,
          resolution: data.resolution ?? null,
          resolvedAt: data.resolvedAt ?? null,
          assignedToId: data.assignedToId ?? null,
          resolvedById: data.resolvedById ?? null,
        },
        include: { reportedBy: true, assignedTo: true, resolvedBy: true },
      });
    }
  
    async updateContentDispute(id: string, data: UpdateContentDisputeInput): Promise<ContentDispute> {
      const updateData: Prisma.ContentDisputeUpdateInput = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.evidence !== undefined && { evidence: data.evidence as Prisma.InputJsonValue }),
        ...(data.resolution !== undefined && { resolution: data.resolution }),
        ...(data.resolvedAt !== undefined && { resolvedAt: data.resolvedAt }),
        ...(data.assignedToId !== undefined && { assignedTo: data.assignedToId ? { connect: { id: data.assignedToId } } : { disconnect: true } }),
        ...(data.resolvedById !== undefined && { resolvedBy: data.resolvedById ? { connect: { id: data.resolvedById } } : { disconnect: true } }),
      };

      return this.prisma.contentDispute.update({
        where: { id },
        data: updateData,
        include: { reportedBy: true, assignedTo: true, resolvedBy: true },
      });
    }
  
    async findCommentById(id: string): Promise<Comment | null> {
      return this.prisma.comment.findUnique({
        where: { id },
        include: {
          user: true,
          content: true,
          replies: { include: { user: true } },
        },
      });
    }
  
    async findContentDisputeById(id: string): Promise<ContentDispute | null> {
      return this.prisma.contentDispute.findUnique({
        where: { id },
        include: {
          content: true,
          reportedBy: true,
          assignedTo: true,
          resolvedBy: true,
        },
      });
    }
  
    async getContentDisputes(contentId: string, page: number, limit: number): Promise<{ items: ContentDispute[], total: number }> {
      const { skip, limit: validatedLimit } = this.validatePagination(page, limit);
      const [items, total] = await Promise.all([
        this.prisma.contentDispute.findMany({
          where: { contentId },
          include: { reportedBy: true, assignedTo: true, resolvedBy: true },
          orderBy: { createdAt: 'desc' as const },
          skip,
          take: validatedLimit,
        }),
        this.prisma.contentDispute.count({ where: { contentId } }),
      ]);
      return { items, total };
    }
  }
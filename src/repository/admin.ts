import {
  PrismaClient,
  PropertyStatus,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { logger } from "../utils";

import { BaseRepository } from "./base";
import {
  AdminPropertyFilters,
  AdminUserFilters,
  AnalyticsDateRange,
} from "../types/services/admin";

export class AdminRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getDashboardStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalProperties: number;
    activeProperties: number;
    pendingVerifications: number;
    totalRevenue: number;
    monthlyGrowth: { users: number; properties: number };
  }> {
    const cacheKey = this.generateCacheKey("admin", "stats");
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );

    const [
      totalUsers,
      activeUsers,
      totalProperties,
      activeProperties,
      pendingVerifications,
      usersLastMonth,
      propertiesLastMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: lastMonth } } }),
      this.prisma.property.count({ where: { createdAt: { gte: lastMonth } } }),
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      totalProperties,
      activeProperties,
      pendingVerifications,
      totalRevenue: 0, // Placeholder for revenue tracking
      monthlyGrowth: { users: usersLastMonth, properties: propertiesLastMonth },
    };

    await this.setCache(cacheKey, stats, 600);
    return stats;
  }

  async getAllUsers(
    filters: AdminUserFilters,
    page: number,
    limit: number
  ): Promise<{ users: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "users",
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{ users: any[]; totalCount: number }>(
      cacheKey
    );
    if (cached) return cached;

    const where = this.buildUserWhereClause(filters);

    const [users, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phoneNumber: true,
          profilePic: true,
          role: true,
          provider: true,
          isVerified: true,
          isActive: true,
          status: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              properties: true,
              propertyLikes: true,
              chatsAsRenter: true,
              chatsAsOwner: true,
              propertyViews: true,
            },
          },
          identityVerifications: {
            select: { status: true, documentType: true, createdAt: true },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    const result = { users, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async getUserById(userId: string): Promise<any> {
    const cacheKey = this.generateCacheKey("admin", "user", userId);
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        properties: {
          select: {
            id: true,
            title: true,
            status: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        identityVerifications: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        propertyLikes: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                amount: true,
                city: true,
                state: true,
              },
            },
          },
          take: 10,
        },
        _count: {
          select: {
            properties: true,
            propertyLikes: true,
            chatsAsRenter: true,
            chatsAsOwner: true,
            propertyViews: true,
          },
        },
      },
    });

    if (!user) return null;

    await this.setCache(cacheKey, user, 600);
    return user;
  }

  async getAllProperties(
    filters: AdminPropertyFilters,
    page: number,
    limit: number
  ): Promise<{ properties: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "properties",
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{
      properties: any[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const where = this.buildPropertyWhereClause(filters);

    const [propertiesRaw, totalCount] = await Promise.all([
      this.prisma.property.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              isVerified: true,
            },
          },
          _count: { select: { likes: true, views: true, conversations: true } },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.property.count({ where }),
    ]);

    // Transform properties to match frontend expectations (stats only)
    const properties = propertiesRaw.map((property) => ({
      ...property,
      stats: {
        likes: property._count.likes,
        views: property._count.views,
        conversations: property._count.conversations,
      },
    }));

    const result = { properties, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async getPendingVerifications(
    page: number,
    limit: number
  ): Promise<{ verifications: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "pending_verifications",
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{
      verifications: any[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const [verifications, totalCount] = await Promise.all([
      this.prisma.identityVerification.findMany({
        where: { status: VerificationStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.PENDING },
      }),
    ]);

    const result = { verifications, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async getPendingOwnershipVerifications(
    page: number,
    limit: number
  ): Promise<{ verifications: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "pending_ownership_verifications",
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{
      verifications: any[];
      totalCount: number;
    }>(cacheKey);
    if (cached) return cached;

    const [verifications, totalCount] = await Promise.all([
      this.prisma.propertyOwnershipProof.findMany({
        where: { status: VerificationStatus.PENDING },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              address: true,
              city: true,
              state: true,
              amount: true,
              owner: true,
            },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.propertyOwnershipProof.count({
        where: { status: VerificationStatus.PENDING },
      }),
    ]);

    const result = { verifications, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async getAdminLogs(
    page: number,
    limit: number
  ): Promise<{ logs: any[]; totalCount: number }> {
    const { skip, limit: validatedLimit } = this.validatePagination(
      page,
      limit
    );
    const cacheKey = this.generateCacheKey(
      "admin",
      "logs",
      page.toString(),
      limit.toString()
    );
    const cached = await this.getCache<{ logs: any[]; totalCount: number }>(
      cacheKey
    );
    if (cached) return cached;

    const [logs, totalCount] = await Promise.all([
      this.prisma.adminActionLog.findMany({
        include: {
          admin: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        skip,
        take: validatedLimit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.adminActionLog.count(),
    ]);

    const result = { logs, totalCount };
    await this.setCache(cacheKey, result, 300);
    return result;
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
    isActive: boolean
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        isActive,
        ...(status !== UserStatus.ACTIVE && { refreshToken: null }),
      },
    });
    await this.deleteCachePattern(`user:${userId}:*`);
  }

  async updatePropertyStatus(
    propertyId: string,
    status: PropertyStatus
  ): Promise<void> {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status },
    });
    await this.deleteCachePattern(`property:${propertyId}:*`);
    await this.deleteCachePattern("properties:*");
  }

  async reviewVerification(
    verificationId: string,
    approved: boolean,
    adminId: string,
    reason?: string
  ): Promise<{
    userId: string;
    userEmail: string;
    userFirstName: string;
    documentType: string;
  }> {
    const verification = await this.prisma.identityVerification.findUnique({
      where: { id: verificationId },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });

    if (!verification) throw new Error("Verification not found");
    if (verification.status !== VerificationStatus.PENDING)
      throw new Error("Verification has already been reviewed");

    await this.prisma.identityVerification.update({
      where: { id: verificationId },
      data: {
        status: approved
          ? VerificationStatus.APPROVED
          : VerificationStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: { set: approved ? null : reason ?? null },
      },
    });

    if (approved) {
      await this.prisma.user.update({
        where: { id: verification.userId },
        data: { isVerified: true },
      });
    }

    await this.deleteCachePattern(`user:${verification.userId}:*`);
    return {
      userId: verification.userId,
      userEmail: verification.user.email,
      userFirstName: verification.user.firstName,
      documentType: verification.documentType,
    };
  }

  async reviewOwnershipVerification(
    verificationId: string,
    approved: boolean,
    adminId: string,
    reason?: string
  ): Promise<{ propertyId: string; ownerId: string; propertyTitle: string }> {
    const verification = await this.prisma.propertyOwnershipProof.findUnique({
      where: { id: verificationId },
      include: { property: true },
    });

    if (!verification) throw new Error("Ownership verification not found");

    await Promise.all([
      this.prisma.propertyOwnershipProof.update({
        where: { id: verificationId },
        data: {
          status: approved
            ? VerificationStatus.APPROVED
            : VerificationStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedBy: adminId,
          rejectionReason: { set: approved ? null : reason ?? null },
        },
      }),
      ...(approved
        ? [
            this.prisma.property.update({
              where: { id: verification.propertyId },
              data: { ownershipVerified: true, status: PropertyStatus.ACTIVE },
            }),
          ]
        : []),
    ]);

    await this.deleteCachePattern(`property:${verification.propertyId}:*`);
    await this.deleteCachePattern("properties:*");
    return {
      propertyId: verification.propertyId,
      ownerId: verification.property.ownerId,
      propertyTitle: verification.property.title,
    };
  }

  async togglePropertyFeatured(
    propertyId: string
  ): Promise<{ featured: boolean; ownerId: string; title: string }> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, title: true, featured: true, ownerId: true },
    });

    if (!property) throw new Error("Property not found");

    const newFeaturedStatus = !property.featured;
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { featured: newFeaturedStatus },
    });

    await this.deleteCachePattern(`property:${propertyId}:*`);
    await this.deleteCachePattern("properties:*");
    return {
      featured: newFeaturedStatus,
      ownerId: property.ownerId,
      title: property.title,
    };
  }

  async getDashboardAnalytics(dateRange?: AnalyticsDateRange): Promise<{
    overview: any;
    charts: { userGrowth: any[]; propertyGrowth: any[] };
  }> {
    const startDate =
      dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();
    const cacheKey = this.generateCacheKey(
      "admin",
      "analytics",
      startDate.toISOString(),
      endDate.toISOString()
    );
    const cached = await this.getCache<any>(cacheKey);
    if (cached) return cached;

    const [
      totalUsers,
      newUsers,
      totalProperties,
      newProperties,
      pendingProperties,
      activeProperties,
      totalConversations,
      totalMessages,
      pendingVerifications,
      approvedVerifications,
      userGrowthData,
      propertyGrowthData,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.property.count(),
      this.prisma.property.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.property.count({
        where: { status: PropertyStatus.PENDING_REVIEW },
      }),
      this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.prisma.conversation.count(),
      this.prisma.message.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.APPROVED },
      }),
      this.getUserGrowthData(startDate, endDate),
      this.getPropertyGrowthData(startDate, endDate),
    ]);

    const analytics = {
      overview: {
        totalUsers,
        newUsers,
        totalProperties,
        newProperties,
        pendingProperties,
        activeProperties,
        totalConversations,
        totalMessages,
        pendingVerifications,
        approvedVerifications,
      },
      charts: {
        userGrowth: userGrowthData,
        propertyGrowth: propertyGrowthData,
      },
    };

    await this.setCache(cacheKey, analytics, 3600);
    return analytics;
  }

  async logAdminAction(
    adminId: string,
    action: string,
    data?: any
  ): Promise<void> {
    try {
      await this.prisma.adminActionLog.create({
        data: { adminId, action, data: data || {} },
      });
    } catch (error) {
      logger.error("Failed to log admin action:", error);
    }
  }

  private buildUserWhereClause(filters: AdminUserFilters): any {
    const where: any = {};
    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.createdAfter)
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phoneNumber: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    return where;
  }

  private buildPropertyWhereClause(filters: AdminPropertyFilters): any {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.city)
      where.city = { contains: filters.city, mode: "insensitive" };
    if (filters.state)
      where.state = { contains: filters.state, mode: "insensitive" };
    if (filters.minAmount)
      where.amount = { ...where.amount, gte: filters.minAmount };
    if (filters.maxAmount)
      where.amount = { ...where.amount, lte: filters.maxAmount };
    if (filters.ownershipVerified !== undefined)
      where.ownershipVerified = filters.ownershipVerified;
    if (filters.featured !== undefined) where.featured = filters.featured;
    if (filters.createdAfter)
      where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
    return where;
  }

  private async getUserGrowthData(
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const userGrowth = await this.prisma.user.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return this.aggregateByDate(userGrowth, startDate, endDate);
  }

  private async getPropertyGrowthData(
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const propertyGrowth = await this.prisma.property.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return this.aggregateByDate(propertyGrowth, startDate, endDate);
  }

  private aggregateByDate(data: any[], startDate: Date, endDate: Date): any[] {
    const dateMap = new Map();
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      dateMap.set(dateKey, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    data.forEach((item) => {
      const dateKey = new Date(item.createdAt).toISOString().split("T")[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + item._count.id);
    });
    return Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }
}

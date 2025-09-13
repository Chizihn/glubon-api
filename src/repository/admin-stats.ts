import {
  PrismaClient,
  PropertyStatus,
  UserStatus,
  VerificationStatus,
  RoleEnum,
  Prisma,
  type User,
  type Property,
  type Transaction
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { Redis } from "ioredis";
import {
  type AnalyticsDateRange,
  type DashboardStats,
  type UserGrowthData,
  type PropertyGrowthData,
  type RevenueData,
  type ActivityData,
  type GeographicData,
  type PerformanceMetrics,
} from "../types/services/admin";
import { 
  type RecentDataResponse as GraphQLRecentDataResponse, 
  type RecentActivity, 
  type RecentTransaction 
} from "../modules/admin/admin.types";
import { BaseRepository } from "../repository/base";

// Helper function to safely convert to Date with proper type narrowing
type DateInput = string | Date | undefined | null;

function toDate(date: DateInput): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Helper function to format date as ISO string with proper type safety
const formatDate = (date: DateInput): string => {
  return toDate(date).toISOString();
};

export class AdminStatsRepository extends BaseRepository {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = this.generateCacheKey("admin", "dashboard_stats");
    const cached = await this.getCache<DashboardStats>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const today = toDate(now); 
    today.setHours(0, 0, 0, 0);
    
    const startOfDay = new Date(today);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      // User metrics
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      verifiedUsers,
      suspendedUsers,

      // Property metrics
      totalProperties,
      activeProperties,
      featuredProperties,
      pendingProperties,
      newPropertiesToday,
      newPropertiesThisWeek,
      newPropertiesThisMonth,

      // Verification metrics
      pendingIdentityVerifications,
      pendingOwnershipVerifications,
      approvedVerificationsToday,
      rejectedVerificationsToday,

      // Activity metrics
      totalConversations,
      activeConversationsToday,
      totalMessages,
      messagesToday,
      totalPropertyViews,
      propertyViewsToday,
      totalPropertyLikes,
      propertyLikesToday,

      // Admin metrics
      totalAdmins,
      activeAdmins,
      adminActionsToday,

      // Growth comparisons
      usersLastMonth,
      propertiesLastMonth,
    ] = await Promise.all([
      // User counts
      this.prisma.user.count({ where: { role: { not: RoleEnum.ADMIN } } }),
      this.prisma.user.count({
        where: { isActive: true, role: { not: RoleEnum.ADMIN } },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: today },
          role: { not: RoleEnum.ADMIN },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: lastWeek },
          role: { not: RoleEnum.ADMIN },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: lastMonth },
          role: { not: RoleEnum.ADMIN },
        },
      }),
      this.prisma.user.count({
        where: {
          isVerified: true,
          role: { not: RoleEnum.ADMIN },
        },
      }),
      this.prisma.user.count({
        where: {
          status: UserStatus.SUSPENDED,
          role: { not: RoleEnum.ADMIN },
        },
      }),

      // Property counts
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.prisma.property.count({ where: { status: PropertyStatus.PENDING_REVIEW } }),
      this.prisma.property.count({
        where: { createdAt: { gte: startOfDay } } as Prisma.PropertyWhereInput,
      }),
      this.prisma.property.count({
        where: { createdAt: { gte: startOfWeek } } as Prisma.PropertyWhereInput,
      }),
      this.prisma.property.count({
        where: { createdAt: { gte: startOfMonth } } as Prisma.PropertyWhereInput,
      }),
      this.prisma.property.count({ where: { createdAt: { gte: lastMonth } } }),

      // Verification counts
      this.prisma.identityVerification.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.propertyOwnershipProof.count({
        where: { status: VerificationStatus.PENDING },
      }),
      this.prisma.identityVerification.count({
        where: {
          status: VerificationStatus.APPROVED,
          reviewedAt: { gte: today },
        },
      }),
      this.prisma.identityVerification.count({
        where: {
          status: VerificationStatus.REJECTED,
          reviewedAt: { gte: today },
        },
      }),

      // Activity counts
      this.prisma.conversation.count(),
      this.prisma.conversation.count({
        where: { updatedAt: { gte: today } },
      }),
      this.prisma.message.count(),
      this.prisma.message.count({ where: { createdAt: { gte: today } } }),
      this.prisma.propertyView.count(),
      this.prisma.propertyView.count({ where: { viewedAt: { gte: today } } }),
      this.prisma.propertyLike.count(),
      this.prisma.propertyLike.count({ where: { createdAt: { gte: today } } }),

      // Admin counts
      this.prisma.user.count({ where: { role: RoleEnum.ADMIN } }),
      this.prisma.user.count({
        where: {
          role: RoleEnum.ADMIN,
          isActive: true,
        },
      }),
      this.prisma.adminActionLog.count({
        where: { createdAt: { gte: today } },
      }),

      // Growth data
      this.prisma.user.count({
        where: {
          createdAt: { gte: lastMonth },
          role: { not: RoleEnum.ADMIN },
        },
      }),
      this.prisma.property.count({ where: { createdAt: { gte: lastMonth } } }),
    ]);

    const stats: DashboardStats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        suspended: suspendedUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
      },
      properties: {
        total: totalProperties,
        active: activeProperties,
        featured: featuredProperties,
        pending: pendingProperties,
        newToday: newPropertiesToday,
        newThisWeek: newPropertiesThisWeek,
        newThisMonth: newPropertiesThisMonth,
      },
      verifications: {
        pendingIdentity: pendingIdentityVerifications,
        pendingOwnership: pendingOwnershipVerifications,
        approvedToday: approvedVerificationsToday,
        rejectedToday: rejectedVerificationsToday,
      },
      activity: {
        totalConversations,
        activeConversationsToday,
        totalMessages,
        messagesToday,
        totalPropertyViews,
        propertyViewsToday,
        totalPropertyLikes,
        propertyLikesToday,
      },
      admin: {
        totalAdmins,
        activeAdmins,
        actionsToday: adminActionsToday,
      },
      growth: {
        users: {
          current: totalUsers,
          lastMonth: usersLastMonth,
          percentChange: this.calculatePercentChange(
            totalUsers,
            usersLastMonth
          ),
        },
        properties: {
          current: totalProperties,
          lastMonth: propertiesLastMonth,
          percentChange: this.calculatePercentChange(
            totalProperties,
            propertiesLastMonth
          ),
        },
      },
      totalRevenue: 0, // Placeholder - would need transaction/payment data
    };

    await this.setCache(cacheKey, stats, 300); // Cache for 5 minutes
    return stats;
  }

  /**
   * Get user growth analytics
   */
  async getUserGrowthAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<UserGrowthData[]> {
    // Ensure we have valid dates, defaulting to last 30 days
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const start = dateRange?.startDate ? toDate(dateRange.startDate) : defaultStartDate;
    const end = dateRange?.endDate ? toDate(dateRange.endDate) : new Date();

    // Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date range provided');
    }

    // Format dates for cache key using our safe formatDate helper
    const startStr = formatDate(start).split('T')[0];
    const endStr = formatDate(end).split('T')[0];

    const cacheKey = this.generateCacheKey(
      "admin",
      "user_growth",
      startStr || '',
      endStr || ''
    );

    const cached = await this.getCache<UserGrowthData[]>(cacheKey);
    if (cached) return cached;

    const userGrowth = await this.prisma.user.groupBy({
      by: ["createdAt", "role"],
      where: {
        createdAt: { gte: start, lte: end },
        role: { not: RoleEnum.ADMIN },
      },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const data = this.aggregateUserGrowthByDate(userGrowth, start, end);
    await this.setCache(cacheKey, data, 3600);
    return data;
  }

  /**
   * Get property growth analytics
   */
  async getPropertyGrowthAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<PropertyGrowthData[]> {
    // Ensure we have valid dates, defaulting to last 30 days
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    
    const start = dateRange?.startDate ? toDate(dateRange.startDate) : defaultStartDate;
    const end = dateRange?.endDate ? toDate(dateRange.endDate) : new Date();

    // Ensure dates are valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date range provided');
    }

    // Format dates for cache key using our safe formatDate helper
    const startStr = formatDate(start).split('T')[0];
    const endStr = formatDate(end).split('T')[0];

    const cacheKey = this.generateCacheKey(
      "admin",
      "property_growth",
      startStr || '',
      endStr || ''
    );

    const cached = await this.getCache<PropertyGrowthData[]>(cacheKey);
    if (cached) return cached;

    const propertyGrowth = await this.prisma.property.groupBy({
      by: ["createdAt", "status"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      orderBy: { createdAt: "asc" },
    });

    const data = this.aggregatePropertyGrowthByDate(propertyGrowth, start, end);
    await this.setCache(cacheKey, data, 3600);
    return data;
  }

  /**
   * Get geographic distribution analytics
   */
  async getGeographicAnalytics(): Promise<GeographicData[]> {
    const cacheKey = this.generateCacheKey("admin", "geographic_data");
    const cached = await this.getCache<GeographicData[]>(cacheKey);
    if (cached) return cached;

    const [usersByState, propertiesByState] = await Promise.all([
      this.prisma.user.groupBy({
        by: ["state"],
        where: {
          role: { not: RoleEnum.ADMIN },
          state: { not: { in: [""] } },
        },
        _count: { id: true },
      }),
      this.prisma.property.groupBy({
        by: ["state"],
        where: {
          state: { not: { in: [""] } },
          status: PropertyStatus.ACTIVE,
        },
        _count: { id: true },
      }),
    ]);

    // Define interface for state count results
    interface StateCount {
      state: string;
      _count: {
        id: number;
      };
    }

    const stateMap = new Map<string, GeographicData>();

    // Process user data
    (usersByState as unknown as StateCount[]).forEach((item) => {
      if (item.state) {
        stateMap.set(item.state, {
          state: item.state,
          users: item._count?.id ?? 0,
          properties: 0,
        });
      }
    });

    // Process property data
    (propertiesByState as unknown as StateCount[]).forEach((item) => {
      if (item.state) {
        const existing = stateMap.get(item.state);
        const count = item._count?.id ?? 0;
        if (existing) {
          existing.properties = count;
        } else {
          stateMap.set(item.state, {
            state: item.state,
            users: 0,
            properties: count,
          });
        }
      }
    });

    const data = Array.from(stateMap.values()).sort(
      (a, b) => b.users + b.properties - (a.users + a.properties)
    );

    await this.setCache(cacheKey, data, 3600);
    return data;
  }

  /**
   * Get activity analytics
   */
  async getActivityAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<ActivityData[]> {
    // Set default date range if not provided (last 7 days)
    const startDate = toDate(dateRange?.startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const endDate = toDate(dateRange?.endDate ?? new Date());

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range provided');
    }

    const cacheKey = this.generateCacheKey(
      "admin",
      "activity_data",
      formatDate(startDate),
      formatDate(endDate)
    );

    const cached = await this.getCache<ActivityData[]>(cacheKey);
    if (cached) return cached;

    const [views, likes, messages, conversations] = await Promise.all([
      this.prisma.propertyView.groupBy({
        by: ["viewedAt"],
        where: { viewedAt: { gte: startDate, lte: endDate } },
        _count: { id: true },
        orderBy: { viewedAt: "asc" },
      }),
      this.prisma.propertyLike.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.message.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.conversation.groupBy({
        by: ["createdAt"],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: { id: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const data = this.aggregateActivityByDate(
      { views, likes, messages, conversations },
      startDate,
      endDate
    );

    await this.setCache(cacheKey, data, 1800); // Cache for 30 minutes
    return data;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = this.generateCacheKey("admin", "performance_metrics");
    const cached = await this.getCache<PerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      // Conversion metrics
      totalPropertyViews,
      totalPropertyLikes,
      totalConversations,

      // Response times (placeholder - would need actual tracking)
      avgVerificationTime,
      avgPropertyApprovalTime,

      // User engagement
      activeUsersLast7Days,
      activeUsersLast30Days,
      repeatUsers,

      // Property performance
      topPerformingProperties,
      avgPropertyViews,
      avgPropertyLikes,
    ] = await Promise.all([
      this.prisma.propertyView.count({
        where: { viewedAt: { gte: last30Days } }, // Using viewedAt instead of createdAt
      }),
      this.prisma.propertyLike.count({
        where: { createdAt: { gte: last30Days } },
      }),
      this.prisma.conversation.count({
        where: { createdAt: { gte: last30Days } },
      }),

      // Calculate average verification processing time
      this.getAverageVerificationTime(),
      this.getAveragePropertyApprovalTime(),

      // Active users
      this.prisma.user.count({
        where: {
          role: { not: RoleEnum.ADMIN },
          OR: [
            { lastLogin: { gte: last7Days } },
            { propertyViews: { some: { viewedAt: { gte: last7Days } } } },
            { sentMessages: { some: { createdAt: { gte: last7Days } } } },
          ],
        },
      }),
      this.prisma.user.count({
        where: {
          role: { not: RoleEnum.ADMIN },
          OR: [
            { lastLogin: { gte: last30Days } },
            { propertyViews: { some: { viewedAt: { gte: last30Days } } } },
            { sentMessages: { some: { createdAt: { gte: last30Days } } } },
          ],
        },
      }),

      // Repeat users (users with multiple property views)
      this.prisma.user.count({
        where: {
          role: { not: RoleEnum.ADMIN },
          propertyViews: { some: {} },
          // _count: { propertyViews: { gt: 5 } },
        },
      }),

      // Top performing properties
      this.prisma.property.findMany({
        select: {
          id: true,
          title: true,
          _count: {
            select: {
              views: true,
              likes: true,
              conversations: true,
            },
          },
        },
        orderBy: {
          views: { _count: "desc" },
        },
        take: 10,
      }),

      // Average metrics
      this.prisma.property.aggregate({
        _avg: {
          amount: true,
          bedrooms: true,
          bathrooms: true,
          sqft: true
        },
        where: { status: PropertyStatus.ACTIVE },
      }),
      0, // Placeholder for average likes
    ]);

    const conversionRate =
      totalPropertyViews > 0
        ? (totalConversations / totalPropertyViews) * 100
        : 0;
    const likeRate =
      totalPropertyViews > 0
        ? (totalPropertyLikes / totalPropertyViews) * 100
        : 0;
    const userRetentionRate =
      activeUsersLast30Days > 0
        ? (activeUsersLast7Days / activeUsersLast30Days) * 100
        : 0;

    const metrics: PerformanceMetrics = {
      conversionRate,
      likeRate,
      userRetentionRate,
      avgVerificationTime,
      avgPropertyApprovalTime,
      activeUsersLast7Days,
      activeUsersLast30Days,
      topPerformingProperties: topPerformingProperties.map((p) => ({
        id: p.id,
        title: p.title,
        views: p._count.views,
        likes: p._count.likes,
        conversations: p._count.conversations,
      })),
    };

    await this.setCache(cacheKey, metrics, 1800);
    return metrics;
  }

  /**
   * Get revenue analytics (placeholder - depends on payment implementation)
   */
  async getRevenueAnalytics(
    dateRange?: AnalyticsDateRange
  ): Promise<RevenueData[]> {
    const startDate = toDate(
      dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const endDate = toDate(dateRange?.endDate || new Date());

    // Ensure dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date range provided');
    }

    const cacheKey = this.generateCacheKey(
      "admin",
      "revenue_data",
      formatDate(startDate),
      formatDate(endDate)
    );

    const cached = await this.getCache<RevenueData[]>(cacheKey);
    if (cached) return cached;

    // Generate date range and create placeholder data
    const dateRangeArray = this.generateDateRange(startDate, endDate);
    const data: RevenueData[] = dateRangeArray.map((date) => ({
      date: toDate(date),
      revenue: new Decimal(0),
      transactions: 0,
      subscriptions: 0,
      commissions: new Decimal(0),
    }));

    await this.setCache(cacheKey, data, 3600); // Cache for 1 hour
    return data;
  }
  /**
   * Export analytics data
   */
  async exportAnalyticsData(
    type:
      | "users"
      | "properties"
      | "activity"
      | "revenue"
      | "verifications"
      | "logs",
    dateRange?: AnalyticsDateRange,
    format: "csv" | "json" | "xlsx" = "csv"
  ): Promise<string> {
    const startDate =
      dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate || new Date();

    let data: any[];

    switch (type) {
      case "users":
        data = await this.getUserGrowthAnalytics(dateRange);
        break;
      case "properties":
        data = await this.getPropertyGrowthAnalytics(dateRange);
        break;
      case "activity":
        data = await this.getActivityAnalytics(dateRange);
        break;
      case "revenue":
        data = await this.getRevenueAnalytics(dateRange);
        break;
      default:
        throw new Error("Invalid export type");
    }

    if (format === "csv") {
      return this.convertToCSV(data);
    } else {
      return JSON.stringify(data, null, 2);
    }
  }

  // Private helper methods

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private aggregateUserGrowthByDate(
    data: any[],
    startDate: Date,
    endDate: Date
  ): UserGrowthData[] {
    const dateMap = new Map<string, { renters: number; listers: number }>();

    // Initialize all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0] || "";
      dateMap.set(dateKey, { renters: 0, listers: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate data
    data.forEach((item) => {
      const dateKey =
        new Date(item.createdAt).toISOString().split("T")[0] || "";
      const existing = dateMap.get(dateKey);
      if (existing) {
        if (item.role === "RENTER") {
          existing.renters += item._count.id;
        } else if (item.role === "LISTER") {
          existing.listers += item._count.id;
        }
      }
    });

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      renters: counts.renters,
      listers: counts.listers,
      total: counts.renters + counts.listers,
    }));
  }

  private aggregatePropertyGrowthByDate(
    data: any[],
    startDate: Date,
    endDate: Date
  ): PropertyGrowthData[] {
    const dateMap = new Map<
      string,
      { active: number; pending: number; total: number }
    >();

    // Initialize all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0] || "";
      dateMap.set(dateKey, { active: 0, pending: 0, total: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate data
    data.forEach((item) => {
      const dateKey =
        new Date(item.createdAt).toISOString().split("T")[0] || "";
      const existing = dateMap.get(dateKey);
      if (existing) {
        existing.total += item._count.id;
        if (item.status === PropertyStatus.ACTIVE) {
          existing.active += item._count.id;
        } else if (item.status === PropertyStatus.PENDING_REVIEW) {
          existing.pending += item._count.id;
        }
      }
    });

    return Array.from(dateMap.entries()).map(([date, counts]) => ({
      date,
      active: counts.active,
      pending: counts.pending,
      total: counts.total,
    }));
  }

  private aggregateActivityByDate(
    data: { views: any[]; likes: any[]; messages: any[]; conversations: any[] },
    startDate: Date,
    endDate: Date
  ): ActivityData[] {
    const dateMap = new Map<string, ActivityData>();

    // Initialize all dates in range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0] || "";
      dateMap.set(dateKey, {
        date: dateKey,
        views: 0,
        likes: 0,
        messages: 0,
        conversations: 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Define type-safe activity type
    type ActivityType = keyof Omit<ActivityData, 'date'>;
    const activityTypes: ActivityType[] = ['views', 'likes', 'messages', 'conversations'];

    // Aggregate all activity types
    activityTypes.forEach((type) => {
      const items = data[type];
      items.forEach((item) => {
        const dateKey = new Date(item.createdAt).toISOString().split("T")[0] || "";
        const existing = dateMap.get(dateKey);
        if (existing) {
          existing[type] = (existing[type] || 0) + (item._count?.id || 0);
        }
      });
    });

    return Array.from(dateMap.values());
  }

  private generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  private async getAverageVerificationTime(): Promise<number> {
    const verifications = await this.prisma.identityVerification.findMany({
      where: {
        status: {
          in: [VerificationStatus.APPROVED, VerificationStatus.REJECTED],
        },
        reviewedAt: { not: null },
      },
      select: {
        createdAt: true,
        reviewedAt: true,
      },
      take: 100,
      orderBy: { reviewedAt: "desc" },
    });

    if (verifications.length === 0) return 0;

    const totalTime = verifications.reduce((sum, verification) => {
      if (verification.reviewedAt) {
        return (
          sum +
          (verification.reviewedAt.getTime() - verification.createdAt.getTime())
        );
      }
      return sum;
    }, 0);

    return Math.round(totalTime / verifications.length / (1000 * 60 * 60)); // Convert to hours
  }

  private async getAveragePropertyApprovalTime(): Promise<number> {
    // This would need to track when properties were submitted vs approved
    // For now, return a placeholder
    return 24; // 24 hours average
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            return typeof value === "string" && value.includes(",")
              ? `"${value}"`
              : value;
          })
          .join(",")
      ),
    ].join("\n");

    return csvContent;
  }

  /**
   * Get recent activity and transactions
   * @param limit Number of items to return (default: 10)
   * @returns Promise containing recent activities and transactions
   */
  async getRecentData(limit: number = 10): Promise<GraphQLRecentDataResponse> {
    try {
      const cacheKey = this.generateCacheKey("recent_data", limit.toString());
      const cached = await this.getCache<GraphQLRecentDataResponse>(cacheKey);
      if (cached) return cached;

      // Get recent signups
      const recentSignups = await this.prisma.user.findMany({
        where: {
          role: { not: RoleEnum.ADMIN },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profilePic: true,
          role: true,
          createdAt: true,
        },
      });

      // Get recent properties (exclude INACTIVE status instead of DELETED)
      const recentProperties = await this.prisma.property.findMany({
        where: {
          status: { not: PropertyStatus.INACTIVE },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePic: true,
            },
          },
        },
      });

      // Get recent verifications (using identityVerifications instead of verification)
      const recentVerifications = await this.prisma.identityVerification.findMany({
        where: {
          status: { not: VerificationStatus.REJECTED },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePic: true,
            },
          },
        },
      });

      // Get recent transactions
      const recentTransactions = await this.prisma.transaction.findMany({
        where: {
          status: { not: "FAILED" },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profilePic: true,
            },
          },
        },
      });

      // Process signups into activities with proper date handling
      const signupActivities: RecentActivity[] = recentSignups.map((user) => {
        const timestamp = toDate(user.createdAt);
        return {
          id: user.id,
          type: 'USER_SIGNUP',
          description: `New user signup: ${user.firstName} ${user.lastName || ''}`.trim(),
          userId: user.id,
          userName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email || 'Unknown User',
          userAvatar: user.profilePic || null,
          timestamp: timestamp,
          metadata: JSON.stringify({
            email: user.email || '',
            role: user.role || 'USER',
          }),
        };
      });

      // Process properties into activities with proper date handling
      const propertyActivities: RecentActivity[] = recentProperties.map((property) => {
        const timestamp = toDate(property.createdAt);
        return {
          id: property.id,
          type: 'PROPERTY_ADDED',
          description: `New property listed: ${property.title || 'Untitled Property'}`,
          userId: property.ownerId || 'unknown',
          userName: property.owner?.firstName && property.owner?.lastName
            ? `${property.owner.firstName} ${property.owner.lastName}`
            : property.owner?.email || 'Unknown User',
          userAvatar: property.owner?.profilePic || null,
          timestamp: timestamp,
          metadata: JSON.stringify({
            propertyId: property.id,
            status: property.status || 'UNKNOWN',
          }),
        };
      });

      // Process verifications into activities with proper typing and date handling
      const verificationActivities: RecentActivity[] = recentVerifications.map((verification: any) => {
        const user = verification.user || {};
        const timestamp = toDate(verification.createdAt);
        return {
          id: verification.id,
          type: 'VERIFICATION_SUBMITTED',
          description: `Verification submitted by ${user.firstName || 'User'}`,
          userId: user.id || 'unknown',
          userName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : 'Unknown User',
          userAvatar: user.profilePic || null,
          timestamp: timestamp,
          metadata: JSON.stringify({
            status: verification.status || 'PENDING',
            type: verification.type || 'IDENTITY',
          }),
        };
      });

      // Combine and sort all activities with proper date handling
      const allActivities = [
        ...signupActivities,
        ...propertyActivities,
        ...verificationActivities,
      ].sort((a, b) => {
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
        return timeB - timeA; // Sort in descending order (newest first)
      }).slice(0, limit);

      // Process transactions with proper date handling
      const transactions: RecentTransaction[] = recentTransactions.map((tx) => {
        const timestamp = toDate(tx.createdAt);
        return {
          id: tx.id,
          type: (tx.type || 'DEPOSIT') as 'SUBSCRIPTION' | 'COMMISSION' | 'REFUND' | 'WITHDRAWAL' | 'DEPOSIT',
          amount: tx.amount ? Number(tx.amount) : 0,
          currency: tx.currency || 'NGN',
          status: (tx.status || 'COMPLETED') as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED',
          timestamp: timestamp,
          userId: tx.user?.id || 'unknown',
          userName: tx.user?.firstName && tx.user?.lastName
            ? `${tx.user.firstName} ${tx.user.lastName}`
            : tx.user?.email || 'Unknown User',
          userAvatar: tx.user?.profilePic || null,
          reference: tx.reference || `tx-${tx.id}`,
          description: tx.description || `Transaction #${tx.id}`,
        };
      });

      const result = {
        recentActivity: allActivities,
        recentTransactions: transactions,
      };

      await this.setCache(cacheKey, result, 300); // Cache for 5 minutes
      return result;
    } catch (error) {
      console.error('Error in getRecentData:', error);
      return {
        recentActivity: [],
        recentTransactions: [],
      };
    }
  }
}

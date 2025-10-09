import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
import {
  AnalyticsDateRange,
  DashboardStats,
  UserGrowthData,
  PropertyGrowthData,
  GeographicData,
  PerformanceMetrics,
  RevenueData,
  ExportRequest,
  ExportResponse,
} from "../types/services/admin";
import {
  RecentDataResponse,
  RecentActivity,
  RecentTransaction as ApiRecentTransaction,
  RecentActivity as ApiRecentActivity,
} from "../modules/admin/admin.types";
import {
  DashboardAnalyticsCharts,
  DashboardAnalyticsResponse,
  GqlActivityData,
} from "../modules/admin/admin-stats.types";

// Extend the ApiRecentTransaction type to include the date field
type RecentTransaction = ApiRecentTransaction & {
  date: Date; // Add date field to match the expected type
};
import { ValidationError } from "../utils";
import * as fs from "fs";
import * as path from "path";
import { AdminStatsRepository } from "../repository/admin-stats";

export class AdminStatsService extends BaseService {
  private repository: AdminStatsRepository;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.repository = new AdminStatsRepository(prisma, redis);
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(
    adminId: string
  ): Promise<IBaseResponse<DashboardStats>> {
    try {
      await this.logAdminAction(adminId, "VIEW_DASHBOARD_STATS");

      const stats = await this.repository.getDashboardStats();

      return this.success(stats, "Dashboard statistics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getDashboardStats");
    }
  }

  /**
   * Get comprehensive dashboard analytics with charts
   */
  async getDashboardAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<DashboardAnalyticsResponse>> {
    try {
      await this.logAdminAction(adminId, "VIEW_DASHBOARD_ANALYTICS", {
        dateRange,
      });

      // Ensure we have a valid date range with a period
      const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const defaultEndDate = new Date();
      const defaultDateRange: AnalyticsDateRange = {
        period: "month",
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      };

      const effectiveDateRange: AnalyticsDateRange = dateRange
        ? { ...dateRange }
        : { ...defaultDateRange };

      // Helper function to safely parse dates
      const parseDate = (
        dateInput: Date | string | undefined
      ): Date | undefined => {
        if (!dateInput) return undefined;
        if (dateInput instanceof Date) {
          // Check if it's a valid date
          return !isNaN(dateInput.getTime()) ? dateInput : undefined;
        }

        // Handle string dates
        if (typeof dateInput === "string") {
          // Handle empty strings
          if (!dateInput.trim()) return undefined;

          // Try parsing the date string
          const parsed = new Date(dateInput);
          if (!isNaN(parsed.getTime())) return parsed;
        }

        // If parsing fails, return undefined to use defaults
        return undefined;
      };

      // Ensure dates are properly converted to Date objects
      const startDate = parseDate(effectiveDateRange.startDate);
      const endDate = parseDate(effectiveDateRange.endDate);

      // Only assign if we have valid dates
      if (startDate) {
        effectiveDateRange.startDate = startDate;
      }
      if (endDate) {
        effectiveDateRange.endDate = endDate;
      }

      // Ensure we have valid dates, fall back to defaults if needed
      if (
        !effectiveDateRange.startDate ||
        (effectiveDateRange.startDate instanceof Date &&
          isNaN(effectiveDateRange.startDate.getTime()))
      ) {
        effectiveDateRange.startDate = defaultStartDate;
      }
      if (
        !effectiveDateRange.endDate ||
        (effectiveDateRange.endDate instanceof Date &&
          isNaN(effectiveDateRange.endDate.getTime()))
      ) {
        effectiveDateRange.endDate = defaultEndDate;
      }

      // If only period is provided, set appropriate date range
      if (
        effectiveDateRange.period &&
        (!effectiveDateRange.startDate ||
          (effectiveDateRange.startDate instanceof Date &&
            isNaN(effectiveDateRange.startDate.getTime())))
      ) {
        const endDate =
          effectiveDateRange.endDate &&
          (effectiveDateRange.endDate instanceof Date
            ? !isNaN(effectiveDateRange.endDate.getTime())
            : true)
            ? new Date(effectiveDateRange.endDate)
            : new Date();
        const startDate = new Date(endDate);

        switch (effectiveDateRange.period) {
          case "week":
            startDate.setDate(endDate.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(endDate.getMonth() - 1);
            break;
          case "year":
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
          default: // 'day' or custom
            startDate.setDate(endDate.getDate() - 1);
        }

        effectiveDateRange.startDate = startDate;
        effectiveDateRange.endDate = endDate;
      }

      // Get all data in parallel
      // Get all data in parallel
      const [
        stats,
        userGrowth,
        propertyGrowth,
        activity,
        geographic,
        performance,
        recentDataResponse,
      ] = await Promise.all([
        this.repository.getDashboardStats(),
        this.repository.getUserGrowthAnalytics(effectiveDateRange),
        this.repository.getPropertyGrowthAnalytics(effectiveDateRange),
        this.repository.getActivityAnalytics(effectiveDateRange),
        this.repository.getGeographicAnalytics(),
        this.repository.getPerformanceMetrics(),
        this.getRecentData(10).catch((error) => {
          console.error("Error in getRecentData:", error);
          return {
            recentActivity: [],
            recentTransactions: [],
          };
        }),
      ]);

      // Cast the response to the correct type to satisfy TypeScript
      const recentData = (recentDataResponse || {
        recentActivity: [],
        recentTransactions: [],
      }) as RecentDataResponse;

      // Transform recent activity data to match GqlActivityData type
      const recentActivity: GqlActivityData[] = (
        recentData.recentActivity || []
      ).map((act: ApiRecentActivity) => {
        // Ensure we have a valid date string
        const dateStr = act.timestamp
          ? new Date(act.timestamp).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0];
        return {
          date: dateStr,
          views: 0,
          likes: 0,
          messages: 0,
          conversations: 0,
        } as GqlActivityData;
      });

      // Transform recent transactions to match RecentTransaction type
      const recentTransactions: RecentTransaction[] = (
        recentData.recentTransactions || []
      ).map(
        (tx) =>
          ({
            ...tx,
            date: tx.timestamp, // Use timestamp as date
            amount: Number(tx.amount) || 0,
            currency: tx.currency || "NGN",
            description: tx.description || "",
            status: tx.status || "COMPLETED",
            reference: tx.reference || "",
            userId: tx.userId || null,
            userName: tx.userName || null,
            userAvatar: tx.userAvatar || null,
          } as RecentTransaction)
      );

      // Create charts data structure
      const charts: DashboardAnalyticsCharts = {
        userGrowth: userGrowth || [],
        propertyGrowth: propertyGrowth || [],
        activity: activity || [],
        geographic: geographic || [],
      };

      // Create the response object with proper typing
      const response: DashboardAnalyticsResponse = {
        overview: {
          users: {
            total: stats.users?.total || 0,
            active: stats.users?.active || 0,
            verified: stats.users?.verified || 0,
            suspended: stats.users?.suspended || 0,
            newToday: stats.users?.newToday || 0,
            newThisWeek: stats.users?.newThisWeek || 0,
            newThisMonth: stats.users?.newThisMonth || 0,
          },
          properties: {
            total: stats.properties?.total || 0,
            active: stats.properties?.active || 0,
            featured: stats.properties?.featured || 0,
            pending: stats.properties?.pending || 0,
            newToday: stats.properties?.newToday || 0,
            newThisWeek: stats.properties?.newThisWeek || 0,
            newThisMonth: stats.properties?.newThisMonth || 0,
          },
          verifications: {
            pendingIdentity: stats.verifications?.pendingIdentity || 0,
            pendingOwnership: stats.verifications?.pendingOwnership || 0,
            approvedToday: stats.verifications?.approvedToday || 0,
            rejectedToday: stats.verifications?.rejectedToday || 0,
          },
          activity: {
            totalConversations: stats.activity?.totalConversations || 0,
            activeConversationsToday:
              stats.activity?.activeConversationsToday || 0,
            totalMessages: stats.activity?.totalMessages || 0,
            messagesToday: stats.activity?.messagesToday || 0,
            totalPropertyViews: stats.activity?.totalPropertyViews || 0,
            propertyViewsToday: stats.activity?.propertyViewsToday || 0,
            totalPropertyLikes: stats.activity?.totalPropertyLikes || 0,
            propertyLikesToday: stats.activity?.propertyLikesToday || 0,
          },
          admin: {
            totalAdmins: stats.admin?.totalAdmins || 0,
            activeAdmins: stats.admin?.activeAdmins || 0,
            actionsToday: stats.admin?.actionsToday || 0,
          },
          growth: {
            users: {
              current: stats.growth?.users?.current || 0,
              lastMonth: stats.growth?.users?.lastMonth || 0,
              percentChange: stats.growth?.users?.percentChange || 0,
            },
            properties: {
              current: stats.growth?.properties?.current || 0,
              lastMonth: stats.growth?.properties?.lastMonth || 0,
              percentChange: stats.growth?.properties?.percentChange || 0,
            },
          },
          totalRevenue: stats.totalRevenue || 0,
        },
        charts,
        performance: performance || {
          conversionRate: 0,
          likeRate: 0,
          userRetentionRate: 0,
          avgVerificationTime: 0,
          avgPropertyApprovalTime: 0,
          activeUsersLast7Days: 0,
          activeUsersLast30Days: 0,
          topPerformingProperties: [],
        },
        recentActivity,
        recentTransactions,
      };

      return this.success(
        response,
        "Dashboard analytics retrieved successfully"
      );
    } catch (error: unknown) {
      console.error("Error in getDashboardAnalytics:", error);
      return this.handleError(error, "getDashboardAnalytics");
    }
  }

  /**
   * Get user growth analytics
   */
  async getUserGrowthAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<UserGrowthData[]>> {
    try {
      this.validateDateRange(dateRange);

      await this.logAdminAction(adminId, "VIEW_USER_GROWTH_ANALYTICS", {
        dateRange,
      });

      const data = await this.repository.getUserGrowthAnalytics(dateRange);

      return this.success(data, "User growth analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getUserGrowthAnalytics");
    }
  }

  /**
   * Get property growth analytics
   */
  async getPropertyGrowthAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<PropertyGrowthData[]>> {
    try {
      this.validateDateRange(dateRange);

      await this.logAdminAction(adminId, "VIEW_PROPERTY_GROWTH_ANALYTICS", {
        dateRange,
      });

      const data = await this.repository.getPropertyGrowthAnalytics(dateRange);

      return this.success(
        data,
        "Property growth analytics retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getPropertyGrowthAnalytics");
    }
  }

  /**
   * Get activity analytics
   */
  async getActivityAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<GqlActivityData[]>> {
    try {
      this.validateDateRange(dateRange);

      await this.logAdminAction(adminId, "VIEW_ACTIVITY_ANALYTICS", {
        dateRange,
      });

      const data = await this.repository.getActivityAnalytics(dateRange);

      return this.success(data, "Activity analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getActivityAnalytics");
    }
  }

  /**
   * Get geographic distribution analytics
   */
  async getGeographicAnalytics(
    adminId: string
  ): Promise<IBaseResponse<GeographicData[]>> {
    try {
      await this.logAdminAction(adminId, "VIEW_GEOGRAPHIC_ANALYTICS");

      const data = await this.repository.getGeographicAnalytics();

      return this.success(data, "Geographic analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getGeographicAnalytics");
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    adminId: string
  ): Promise<IBaseResponse<PerformanceMetrics>> {
    try {
      await this.logAdminAction(adminId, "VIEW_PERFORMANCE_METRICS");

      const metrics = await this.repository.getPerformanceMetrics();

      return this.success(
        metrics,
        "Performance metrics retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getPerformanceMetrics");
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(
    adminId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<RevenueData[]>> {
    try {
      this.validateDateRange(dateRange);

      await this.logAdminAction(adminId, "VIEW_REVENUE_ANALYTICS", {
        dateRange,
      });

      const data = await this.repository.getRevenueAnalytics(dateRange);

      return this.success(data, "Revenue analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getRevenueAnalytics");
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(
    adminId: string,
    request: ExportRequest
  ): Promise<IBaseResponse<ExportResponse>> {
    try {
      this.validateExportRequest(request);

      await this.logAdminAction(adminId, "EXPORT_ANALYTICS_DATA", request);

      const data = await this.repository.exportAnalyticsData(
        request.type,
        request.dateRange,
        request.format
      );

      // Generate filename
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${request.type}_analytics_${timestamp}.${request.format}`;

      // Save to temporary storage (implement your preferred storage solution)
      const downloadUrl = await this.saveExportFile(data, filename);

      const response: ExportResponse = {
        downloadUrl,
        filename,
        size: Buffer.byteLength(data, "utf8"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      return this.success(response, "Analytics data exported successfully");
    } catch (error: unknown) {
      return this.handleError(error, "exportAnalyticsData");
    }
  }

  /**
   * Get real-time statistics (cached for shorter duration)
   */
  async getRealTimeStats(adminId: string): Promise<IBaseResponse<any>> {
    try {
      const cacheKey = this.generateCacheKey("admin", "realtime_stats");
      const cached = await this.getCache<any>(cacheKey);

      if (cached) {
        return this.success(
          cached,
          "Real-time statistics retrieved from cache"
        );
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisHour = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours()
      );

      const [
        onlineUsers, // Would need session tracking
        activeConversations,
        newUsersToday,
        newPropertiesToday,
        propertyViewsThisHour,
        messagesThisHour,
      ] = await Promise.all([
        // Placeholder for online users - would need session/socket tracking
        0,
        this.prisma.conversation.count({
          where: {
            updatedAt: { gte: today },
          },
        }),
        this.prisma.user.count({
          where: {
            createdAt: { gte: today },
            role: { not: "ADMIN" },
          },
        }),
        this.prisma.property.count({
          where: {
            createdAt: { gte: today },
          },
        }),
        this.prisma.propertyView.count({
          where: {
            viewedAt: { gte: thisHour },
          },
        }),
        this.prisma.message.count({
          where: {
            createdAt: { gte: thisHour },
          },
        }),
      ]);

      const stats = {
        onlineUsers,
        activeConversations,
        newUsersToday,
        newPropertiesToday,
        propertyViewsThisHour,
        messagesThisHour,
        lastUpdated: now,
      };

      // Get recent data
      const recentData = await this.getRecentData();

      // Transform transactions to match the RecentTransaction type
      const formattedRecentTransactions: RecentTransaction[] = (
        recentData.recentTransactions || []
      ).map((tx) => {
        const timestamp = tx.timestamp || new Date();
        return {
          id: tx.id || "",
          type: tx.type || "SUBSCRIPTION",
          amount: Number(tx.amount) || 0,
          date: timestamp,
          description: tx.description || "",
          status: tx.status || "COMPLETED",
          currency: "USD",
          reference: tx.reference || "",
          userId: tx.userId || null,
          userName: tx.userName || null,
          userAvatar: tx.userAvatar || null,
          timestamp, // Keep original timestamp for reference
        };
      });

      // Create a full response object with required fields
      const responseWithRecentData: DashboardAnalyticsResponse = {
        overview: {
          users: {
            total: stats.onlineUsers,
            active: stats.activeConversations,
            verified: 0,
            suspended: 0,
            newToday: stats.newUsersToday,
            newThisWeek: 0,
            newThisMonth: 0,
          },
          properties: {
            total: 0,
            active: 0,
            featured: 0,
            pending: 0,
            newToday: stats.newPropertiesToday,
            newThisWeek: 0,
            newThisMonth: 0,
          },
          verifications: {
            pendingIdentity: 0,
            pendingOwnership: 0,
            approvedToday: 0,
            rejectedToday: 0,
          },
          activity: {
            totalConversations: stats.activeConversations,
            activeConversationsToday: stats.activeConversations,
            totalMessages: 0,
            messagesToday: stats.messagesThisHour,
            totalPropertyViews: 0,
            propertyViewsToday: stats.propertyViewsThisHour,
            totalPropertyLikes: 0,
            propertyLikesToday: 0,
          },
          admin: {
            totalAdmins: 0,
            activeAdmins: 0,
            actionsToday: 0,
          },
          growth: {
            users: {
              current: stats.newUsersToday,
              lastMonth: 0,
              percentChange: 0,
            },
            properties: {
              current: stats.newPropertiesToday,
              lastMonth: 0,
              percentChange: 0,
            },
          },
          totalRevenue: 0,
        },
        charts: {
          userGrowth: [],
          propertyGrowth: [],
          activity: [],
          geographic: [],
        },
        performance: {
          conversionRate: 0,
          likeRate: 0,
          userRetentionRate: 0,
          avgVerificationTime: 0,
          avgPropertyApprovalTime: 0,
          activeUsersLast7Days: 0,
          activeUsersLast30Days: 0,
          topPerformingProperties: [],
        },
        recentActivity:
          recentData.recentActivity as unknown as GqlActivityData[],
        recentTransactions: formattedRecentTransactions,
      };

      await this.setCache(cacheKey, responseWithRecentData, 3600);
      return this.success(
        responseWithRecentData,
        "Real-time statistics retrieved successfully"
      );
    } catch (error: unknown) {
      return this.handleError(error, "getRealTimeStats");
    }
  }

  /**
   * Get custom analytics based on filters
   */
  async getCustomAnalytics(
    adminId: string,
    filters: {
      metrics: string[];
      groupBy: "day" | "week" | "month";
      dateRange: AnalyticsDateRange;
      segments?: Record<string, any>;
    }
  ): Promise<IBaseResponse<any>> {
    try {
      this.validateDateRange(filters.dateRange);

      await this.logAdminAction(adminId, "VIEW_CUSTOM_ANALYTICS", filters);

      const results: Record<string, any> = {};

      for (const metric of filters.metrics) {
        switch (metric) {
          case "user_signups":
            results[metric] = await this.getCustomUserSignups(filters);
            break;
          case "property_listings":
            results[metric] = await this.getCustomPropertyListings(filters);
            break;
          case "user_activity":
            results[metric] = await this.getCustomUserActivity(filters);
            break;
          case "conversion_rates":
            results[metric] = await this.getCustomConversionRates(filters);
            break;
          default:
            // Skip unknown metrics
            break;
        }
      }

      return this.success(results, "Custom analytics retrieved successfully");
    } catch (error: unknown) {
      return this.handleError(error, "getCustomAnalytics");
    }
  }

  // Private helper methods

  private validateDateRange(dateRange?: AnalyticsDateRange): void {
    if (!dateRange) return;

    // Helper function to safely parse dates
    const parseDate = (
      dateInput: Date | string | undefined
    ): Date | undefined => {
      if (!dateInput) return undefined;
      if (dateInput instanceof Date) {
        return !isNaN(dateInput.getTime()) ? dateInput : undefined;
      }
      if (typeof dateInput === "string") {
        if (!dateInput.trim()) return undefined;
        const parsed = new Date(dateInput);
        return !isNaN(parsed.getTime()) ? parsed : undefined;
      }
      return undefined;
    };

    // Convert string dates to Date objects if needed
    const startDate = parseDate(dateRange.startDate);
    const endDate = parseDate(dateRange.endDate);

    if (startDate && endDate) {
      if (startDate > endDate) {
        throw new ValidationError("Start date cannot be after end date");
      }

      const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days
      if (endDate.getTime() - startDate.getTime() > maxRange) {
        throw new ValidationError("Date range cannot exceed 365 days");
      }
    }
  }

  private validateExportRequest(request: ExportRequest): void {
    const validTypes = [
      "users",
      "properties",
      "activity",
      "revenue",
      "verifications",
      "logs",
    ];
    const validFormats = ["csv", "json", "xlsx"];

    if (!validTypes.includes(request.type)) {
      throw new ValidationError(
        `Invalid export type. Must be one of: ${validTypes.join(", ")}`
      );
    }

    if (!validFormats.includes(request.format)) {
      throw new ValidationError(
        `Invalid export format. Must be one of: ${validFormats.join(", ")}`
      );
    }

    this.validateDateRange(request.dateRange);
  }

  private async saveExportFile(
    data: string,
    filename: string
  ): Promise<string> {
    // Implement your preferred file storage solution
    // This could be AWS S3, Google Cloud Storage, local filesystem, etc.

    // For demo purposes, using local storage
    const uploadsDir = path.join(process.cwd(), "temp", "exports");

    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, data);

    // Return download URL (would be your actual file serving URL)
    return `/api/exports/${filename}`;
  }

  private async getCustomUserSignups(filters: any): Promise<any[]> {
    // Implement custom user signup analytics
    return [];
  }

  private async getCustomPropertyListings(filters: any): Promise<any[]> {
    // Implement custom property listing analytics
    return [];
  }

  private async getCustomUserActivity(filters: any): Promise<any[]> {
    // Implement custom user activity analytics
    return [];
  }

  /**
   * Get recent activities and transactions
   * @param limit Number of items to return (default: 10)
   */
  async getRecentData(limit: number = 10): Promise<RecentDataResponse> {
    try {
      // Get the raw data from the repository
      const data = await this.repository.getRecentData(limit);

      // Transform the data to match the RecentDataResponse type
      const recentActivity: any[] = (data.recentActivity || []).map((act) => ({
        id: act.id || "",
        type: act.type || "OTHER",
        description: act.description || "",
        timestamp: act.timestamp || new Date(),
        userId: act.userId || undefined,
        userName: act.userName || undefined,
        userAvatar: act.userAvatar || undefined,
        metadata: {},
      }));

      // Transform transactions to match RecentTransaction type
      const recentTransactions: any[] = (data.recentTransactions || []).map(
        (tx) => ({
          id: tx.id || "",
          type: tx.type || "OTHER",
          amount: Number(tx.amount) || 0,
          currency: tx.currency || "USD",
          status: tx.status || "COMPLETED",
          reference: tx.reference || "",
          userId: tx.userId || undefined,
          userName: tx.userName || undefined,
          userAvatar: tx.userAvatar || undefined,
          date: tx.timestamp || new Date(),
          timestamp: tx.timestamp || new Date(),
          description: tx.description || "",
        })
      );

      return { recentActivity, recentTransactions };
    } catch (error) {
      console.error("Error in getRecentData:", error);
      // Return empty arrays in case of error to maintain type safety
      return {
        recentActivity: [],
        recentTransactions: [],
      };
    }
  }

  private async getCustomConversionRates(filters: any): Promise<any[]> {
    // Implement custom conversion rate analytics
    return [] as any[];
    return [];
  }

  private async logAdminAction(
    adminId: string,
    action: string,
    data?: any
  ): Promise<void> {
    try {
      await this.prisma.adminActionLog.create({
        data: {
          adminId,
          action,
          data: data || {},
        },
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error("Failed to log admin action:", error);
    }
  }
}

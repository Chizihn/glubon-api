import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
import {
  AnalyticsDateRange,
  DashboardStats,
  DashboardAnalyticsResponse,
  UserGrowthData,
  PropertyGrowthData,
  ActivityData,
  GeographicData,
  PerformanceMetrics,
  RevenueData,
  ExportRequest,
  ExportResponse,
} from "../types/services/admin";
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

      const [
        overview,
        userGrowth,
        propertyGrowth,
        activity,
        geographic,
        performance,
      ] = await Promise.all([
        this.repository.getDashboardStats(),
        this.repository.getUserGrowthAnalytics(dateRange),
        this.repository.getPropertyGrowthAnalytics(dateRange),
        this.repository.getActivityAnalytics(dateRange),
        this.repository.getGeographicAnalytics(),
        this.repository.getPerformanceMetrics(),
      ]);

      const analytics: DashboardAnalyticsResponse = {
        overview,
        charts: {
          userGrowth,
          propertyGrowth,
          activity,
          geographic,
        },
        performance,
      };

      return this.success(
        analytics,
        "Dashboard analytics retrieved successfully"
      );
    } catch (error: unknown) {
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
  ): Promise<IBaseResponse<ActivityData[]>> {
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

      // Cache for 1 minute
      await this.setCache(cacheKey, stats, 60 as any);

      return this.success(stats, "Real-time statistics retrieved successfully");
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

    if (dateRange.startDate && dateRange.endDate) {
      if (dateRange.startDate > dateRange.endDate) {
        throw new ValidationError("Start date cannot be after end date");
      }

      const maxRange = 365 * 24 * 60 * 60 * 1000; // 365 days
      if (
        dateRange.endDate.getTime() - dateRange.startDate.getTime() >
        maxRange
      ) {
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

  private async getCustomConversionRates(filters: any): Promise<any[]> {
    // Implement custom conversion rate analytics
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

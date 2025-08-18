import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
  Int,
} from "type-graphql";
import type { Context } from "../../types/context";
import { RoleEnum, UserStatus } from "@prisma/client";
import { BaseResponse } from "../../types/responses";
import { prisma } from "../../config/database";
import redis from "../../config/redis";
import { AuthMiddleware, RequireRole } from "../../middleware";
import {
  PaginatedLogsResponse,
  PaginatedOwnershipVerificationsResponse,
  AdminPaginatedPropertiesResponse as PaginatedPropertiesResponse,
  PaginatedUsersResponse,
  PaginatedVerificationsResponse,
  AdminUserResponse,
  ExportResponse,
  BulkUpdateResponse,
} from "./admin.types";
import {
  AdminPropertyFilters,
  AdminUserFilters,
  ReviewVerificationInput,
  UpdateUserStatusInput,
  AnalyticsDateRangeInput,
  UpdatePropertyStatusInput,
  CreateAdminUserInput,
  ExportRequestInput,
  UpdateAdminUserInput,
  AdminListFilters,
} from "./admin-user.inputs";
import { AppError } from "../../utils";
import { HttpStatusCode } from "axios";
import { AdminStatsService } from "../../services/admin-stats";
import { AdminUsersService } from "../../services/admin-user";
import {
  DashboardAnalyticsResponse as DashboardAnalyticsResponseType,
  UserGrowthData as UserGrowthDataType,
} from "../../types/services/admin";
import {
  ActivityData,
  AdminStatsResponse,
  DashboardAnalyticsResponse,
  GeographicData,
  PerformanceMetrics,
  PropertyGrowthData,
  RevenueData,
  UserGrowthData,
} from "./admin-stats.types";

@Resolver()
@UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
export class AdminResolver {
  private adminStatsService: AdminStatsService;
  private adminUsersService: AdminUsersService;

  constructor() {
    this.adminStatsService = new AdminStatsService(prisma, redis);
    this.adminUsersService = new AdminUsersService(prisma, redis);
  }

  // ==================== STATS & ANALYTICS QUERIES ====================

  @Query(() => AdminStatsResponse)
  async getAdminDashboardStats(
    @Ctx() ctx: Context
  ): Promise<AdminStatsResponse> {
    const result = await this.adminStatsService.getDashboardStats(ctx.user!.id);
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    
    // Transform the response to match AdminStatsResponse type
    const stats = result.data!;
    
    // Calculate pending verifications
    const pendingVerifications = 
      (stats.verifications?.pendingIdentity || 0) + 
      (stats.verifications?.pendingOwnership || 0);

    return {
      totalUsers: stats.users?.total || 0,
      activeUsers: stats.users?.active || 0,
      totalProperties: stats.properties?.total || 0,
      activeProperties: stats.properties?.active || 0,
      pendingVerifications,
      totalRevenue: stats.totalRevenue || 0,
      monthlyGrowth: {
        users: stats.growth?.users?.percentChange || 0,
        properties: stats.growth?.properties?.percentChange || 0
      }
    };
  }

  @Query(() => DashboardAnalyticsResponse)
  async getAdminAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<DashboardAnalyticsResponseType> {
    const result = await this.adminStatsService.getDashboardAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [UserGrowthData])
  async getUserGrowthAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<UserGrowthDataType[]> {
    const result = await this.adminStatsService.getUserGrowthAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [PropertyGrowthData])
  async getPropertyGrowthAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<PropertyGrowthData[]> {
    const result = await this.adminStatsService.getPropertyGrowthAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [ActivityData])
  async getActivityAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<ActivityData[]> {
    const result = await this.adminStatsService.getActivityAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [GeographicData])
  async getGeographicAnalytics(@Ctx() ctx: Context): Promise<GeographicData[]> {
    const result = await this.adminStatsService.getGeographicAnalytics(
      ctx.user!.id
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => PerformanceMetrics)
  async getPerformanceMetrics(
    @Ctx() ctx: Context
  ): Promise<PerformanceMetrics> {
    const result = await this.adminStatsService.getPerformanceMetrics(
      ctx.user!.id
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [RevenueData])
  async getRevenueAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<RevenueData[]> {
    const result = await this.adminStatsService.getRevenueAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => AdminStatsResponse)
  async getRealTimeStats(@Ctx() ctx: Context): Promise<AdminStatsResponse> {
    const result = await this.adminStatsService.getRealTimeStats(ctx.user!.id);
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [ActivityData])
  async getCustomAnalytics(
    @Arg("metrics", () => [String]) metrics: string[],
    @Arg("groupBy") groupBy: "day" | "week" | "month",
    @Arg("dateRange") dateRange: AnalyticsDateRangeInput,
    @Arg("segments", { nullable: true }) segments: string, // JSON string
    @Ctx() ctx: Context
  ): Promise<ActivityData[]> {
    const parsedSegments = segments ? JSON.parse(segments) : undefined;
    const result = await this.adminStatsService.getCustomAnalytics(
      ctx.user!.id,
      {
        metrics,
        groupBy,
        dateRange,
        segments: parsedSegments,
      }
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  // ==================== USER MANAGEMENT QUERIES ====================

  @Query(() => PaginatedUsersResponse)
  async getAllUsers(
    @Arg("filters", { nullable: true }) filters: AdminUserFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedUsersResponse> {
    const result = await this.adminUsersService.getAllUsers(
      ctx.user!.id,
      filters || {},
      page,
      limit
    );
    
    if (!result.success) {
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    }
    
    return new PaginatedUsersResponse(
      result.data?.items || [],
      page,
      limit,
      result.data?.pagination?.totalCount || 0
    );
  }

  @Query(() => PaginatedUsersResponse, { name: "getAdminUsers" })
  async getAdminUsers(
    @Arg("filters", { nullable: true }) filters: AdminListFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedUsersResponse> {
    const result = await this.adminUsersService.getAllAdmins(
      ctx.user!.id,
      filters || {},
      page,
      limit
    );
    
    if (!result.success) {
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    }
    
    return new PaginatedUsersResponse(
      result.data?.items || [],
      page,
      limit,
      result.data?.pagination?.totalCount || 0
    );
  }

  @Query(() => AdminUserResponse)
  async getAdminUserById(
    @Arg("userId") userId: string,
    @Arg("includeFullDetails", { defaultValue: true })
    includeFullDetails: boolean,
    @Ctx() ctx: Context
  ): Promise<AdminUserResponse> {
    const result = await this.adminUsersService.getUserById(
      ctx.user!.id,
      userId,
      includeFullDetails
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Query(() => [ActivityData])
  async getUserActivity(
    @Arg("userId") userId: string,
    @Arg("days", () => Int, { defaultValue: 30 }) days: number,
    @Ctx() ctx: Context
  ): Promise<ActivityData[]> {
    const result = await this.adminUsersService.getUserActivity(
      ctx.user!.id,
      userId,
      days
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  // ==================== PROPERTIES, VERIFICATIONS & LOGS (Legacy) ====================

  @Query(() => PaginatedPropertiesResponse)
  async getAllProperties(
    @Arg("filters", { nullable: true }) filters: AdminPropertyFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const result = await this.adminUsersService.getAllProperties(
      ctx.user!.id,
      filters || {},
      page,
      limit
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);

    const { properties, totalCount } = result.data!;
    const items = (properties ?? []).map(
      this.transformPropertyToResponse.bind(this)
    );
    return new PaginatedPropertiesResponse(items, page, limit, totalCount);
  }

  @Query(() => PaginatedVerificationsResponse)
  async getPendingVerifications(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedVerificationsResponse> {
    const result = await this.adminUsersService.getPendingVerifications(
      ctx.user!.id,
      page,
      limit
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);

    const { verifications, totalCount } = result.data!;
    return new PaginatedVerificationsResponse(
      verifications,
      page,
      limit,
      totalCount
    );
  }

  @Query(() => PaginatedOwnershipVerificationsResponse)
  async getPendingOwnershipVerifications(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedOwnershipVerificationsResponse> {
    const result =
      await this.adminUsersService.getPendingOwnershipVerifications(
        ctx.user!.id,
        page,
        limit
      );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);

    const { verifications, totalCount } = result.data!;
    return new PaginatedOwnershipVerificationsResponse(
      verifications,
      page,
      limit,
      totalCount
    );
  }

  @Query(() => PaginatedLogsResponse)
  async getAdminLogs(
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedLogsResponse> {
    const result = await this.adminUsersService.getAdminLogs(
      ctx.user!.id,
      page,
      limit
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);

    const { logs, totalCount } = result.data!;
    const transformedLogs = logs.map((log) => ({
      ...log,
      data: JSON.stringify(log.data),
    }));
    return new PaginatedLogsResponse(transformedLogs, page, limit, totalCount);
  }

  // ==================== USER MANAGEMENT MUTATIONS ====================

  @Mutation(() => AdminUserResponse)
  async createAdminUser(
    @Arg("input") input: CreateAdminUserInput,
    @Ctx() ctx: Context
  ): Promise<AdminUserResponse> {
    const result = await this.adminUsersService.createAdminUser(
      ctx.user!.id,
      input
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Mutation(() => AdminUserResponse)
  async updateAdminUser(
    @Arg("adminId") adminId: string,
    @Arg("input") input: UpdateAdminUserInput,
    @Ctx() ctx: Context
  ): Promise<AdminUserResponse> {
    const result = await this.adminUsersService.updateAdminUser(
      ctx.user!.id,
      adminId,
      input
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  @Mutation(() => BaseResponse)
  async updateUserStatus(
    @Arg("input") input: UpdateUserStatusInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.updateUserStatus(
      ctx.user!.id,
      input
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async deactivateAdminUser(
    @Arg("adminId") adminId: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.deactivateAdminUser(
      ctx.user!.id,
      adminId
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BulkUpdateResponse)
  async bulkUpdateUserStatus(
    @Arg("userIds", () => [String]) userIds: string[],
    @Arg("status", () => UserStatus)  status: UserStatus,
    @Arg("reason", { nullable: true }) reason: string,
    @Ctx() ctx: Context
  ): Promise<BulkUpdateResponse> {
    const result = await this.adminUsersService.bulkUpdateUserStatus(
      ctx.user!.id,
      userIds,
      status,
      reason
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  // ==================== ANALYTICS MUTATIONS ====================

  @Mutation(() => ExportResponse)
  async exportAnalyticsData(
    @Arg("request") request: ExportRequestInput,
    @Ctx() ctx: Context
  ): Promise<ExportResponse> {
    const result = await this.adminStatsService.exportAnalyticsData(
      ctx.user!.id,
      request
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return result.data!;
  }

  // ==================== LEGACY MUTATIONS (Using AdminService) ====================

  @Mutation(() => BaseResponse)
  async updatePropertyStatus(
    @Arg("input") input: UpdatePropertyStatusInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.updatePropertyStatus(
      ctx.user!.id,
      input
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async reviewVerification(
    @Arg("input") input: ReviewVerificationInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.reviewVerification(
      ctx.user!.id,
      input
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async reviewOwnershipVerification(
    @Arg("verificationId") verificationId: string,
    @Arg("approved") approved: boolean,
    @Arg("reason", { nullable: true }) reason: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.reviewOwnershipVerification(
      ctx.user!.id,
      verificationId,
      approved,
      reason
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async togglePropertyFeatured(
    @Arg("propertyId") propertyId: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminUsersService.togglePropertyFeatured(
      ctx.user!.id,
      propertyId
    );
    if (!result.success)
      throw new AppError(result.message, HttpStatusCode.InternalServerError);
    return new BaseResponse(true, result.message);
  }

  // ==================== HELPER METHODS ====================

  private transformPropertyToResponse(property: any): any {
    return {
      ...property,
      stats: {
        likes: property._count?.likes || 0,
        views: property._count?.views || 0,
        conversations: property._count?.conversations || 0,
      },
    };
  }
}

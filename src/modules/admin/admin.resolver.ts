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
import { RoleEnum } from "@prisma/client";
import { BaseResponse } from "../../types/responses";
import { prisma } from "../../config/database";
import redis from "../../config/redis";
import { AuthMiddleware, RequireRole } from "../../middleware";
import {
  AdminStatsResponse,
  DashboardAnalyticsResponse,
  PaginatedLogsResponse,
  PaginatedOwnershipVerificationsResponse,
  AdminPaginatedPropertiesResponse as PaginatedPropertiesResponse,
  PaginatedUsersResponse,
  PaginatedVerificationsResponse,
  AdminUserResponse,
} from "./admin.types";
import {
  AdminPropertyFilters,
  AdminUserFilters,
  ReviewVerificationInput,
  UpdateUserStatusInput,
  AnalyticsDateRangeInput,
  UpdatePropertyStatusInput,
} from "./admin.inputs";
import { AdminService } from "../../services/admin";

@Resolver()
@UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.ADMIN))
export class AdminResolver {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService(prisma, redis);
  }

  private transformUserToResponse(user: any): AdminUserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber ?? null,
      profilePic: user.profilePic ?? null,
      role: user.role,
      provider: user.provider,
      isVerified: user.isVerified,
      isActive: user.isActive,
      status: user.status,
      city: user.city ?? null,
      state: user.state ?? null,
      address: user.address ?? null,
      country: user.country ?? null,
      lastLogin: user.lastLogin ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      stats: {
        properties: user._count.properties,
        propertyLikes: user._count.propertyLikes,
        conversations:
          (user._count.chatsAsRenter || 0) + (user._count.chatsAsOwner || 0),
        propertyViews: user._count.propertyViews || 0,
      },
      properties: user.properties || [],
      identityVerifications: user.identityVerifications || [],
      propertyLikes: user.propertyLikes || [],
    };
  }

  private transformPropertyToResponse(property: any): any {
    return {
      ...property,
      stats: {
        likes: property._count.likes,
        views: property._count.views,
        conversations: property._count.conversations,
      },
    };
  }

  @Query(() => AdminStatsResponse)
  async getAdminDashboardStats(
    @Ctx() ctx: Context
  ): Promise<AdminStatsResponse> {
    const result = await this.adminService.getDashboardStats(ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Query(() => PaginatedUsersResponse)
  async getAdminUsers(
    @Arg("filters", { nullable: true }) filters: AdminUserFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedUsersResponse> {
    const result = await this.adminService.getAllUsers(
      ctx.user!.id,
      filters || {},
      page,
      limit
    );
    if (!result.success) throw new Error(result.message);

    const { users, totalCount } = result.data!;
    const transformedUsers = users.map(this.transformUserToResponse.bind(this));
    return new PaginatedUsersResponse(
      transformedUsers,
      page,
      limit,
      totalCount
    );
  }

  @Query(() => AdminUserResponse)
  async getAdminUserById(
    @Arg("userId") userId: string,
    @Ctx() ctx: Context
  ): Promise<AdminUserResponse> {
    const result = await this.adminService.getUserById(ctx.user!.id, userId);
    if (!result.success) throw new Error(result.message);
    return this.transformUserToResponse(result.data!);
  }

  @Query(() => PaginatedPropertiesResponse)
  async getAdminProperties(
    @Arg("filters", { nullable: true }) filters: AdminPropertyFilters,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx: Context
  ): Promise<PaginatedPropertiesResponse> {
    const result = await this.adminService.getAllProperties(
      ctx.user!.id,
      filters || {},
      page,
      limit
    );
    if (!result.success) throw new Error(result.message);

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
    const result = await this.adminService.getPendingVerifications(
      ctx.user!.id,
      page,
      limit
    );
    if (!result.success) throw new Error(result.message);

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
    const result = await this.adminService.getPendingOwnershipVerifications(
      ctx.user!.id,
      page,
      limit
    );
    if (!result.success) throw new Error(result.message);

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
    const result = await this.adminService.getAdminLogs(
      ctx.user!.id,
      page,
      limit
    );
    if (!result.success) throw new Error(result.message);

    const { logs, totalCount } = result.data!;
    const transformedLogs = logs.map((log) => ({
      ...log,
      data: JSON.stringify(log.data),
    }));
    return new PaginatedLogsResponse(transformedLogs, page, limit, totalCount);
  }

  @Query(() => DashboardAnalyticsResponse)
  async getAdminAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<DashboardAnalyticsResponse> {
    const result = await this.adminService.getDashboardAnalytics(
      ctx.user!.id,
      dateRange
    );
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => BaseResponse)
  async updateUserStatus(
    @Arg("input") input: UpdateUserStatusInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminService.updateUserStatus(
      ctx.user!.id,
      input
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async updatePropertyStatus(
    @Arg("input") input: UpdatePropertyStatusInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminService.updatePropertyStatus(
      ctx.user!.id,
      input
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async reviewVerification(
    @Arg("input") input: ReviewVerificationInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminService.reviewVerification(
      ctx.user!.id,
      input
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async reviewOwnershipVerification(
    @Arg("verificationId") verificationId: string,
    @Arg("approved") approved: boolean,
    @Arg("reason", { nullable: true }) reason: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminService.reviewOwnershipVerification(
      ctx.user!.id,
      verificationId,
      approved,
      reason
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async togglePropertyFeatured(
    @Arg("propertyId") propertyId: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.adminService.togglePropertyFeatured(
      ctx.user!.id,
      propertyId
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }
}

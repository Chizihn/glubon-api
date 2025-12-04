// src/resolvers/analytics.resolver.ts
import { Resolver, Query, Arg, Ctx, UseMiddleware } from "type-graphql";
import { Context } from "../../types/context";
// import { getContainer } from "../../services";
import { AuthMiddleware, RequireRole } from "../../middleware/auth";
import { RoleEnum } from "@prisma/client";
import {
  ListerAnalyticsResponse,
  PropertyAnalyticsResponse,
  RevenueAnalyticsResponse,
  BookingAnalyticsResponse,
  MarketInsightsResponse,
  AnalyticsDateRangeInput,
} from "./analytics.types";
import { ListerAnalyticsService } from "../../services/lister-analytics";


import { Service } from "typedi";

@Service()
@Resolver()
export class AnalyticsResolver {
  constructor(
    private svc: ListerAnalyticsService
  ) {}

  @Query(() => ListerAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getListerAnalytics(
    @Ctx() ctx: Context,
    @Arg("dateRange", { nullable: true }) dr?: AnalyticsDateRangeInput,
  ): Promise<ListerAnalyticsResponse> {
    return this.svc.getListerAnalytics(ctx.user!.id, dr);
  }

  @Query(() => PropertyAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getPropertyAnalytics(
    @Ctx() ctx: Context,
    @Arg("propertyId") propertyId: string,
    @Arg("dateRange", { nullable: true }) dr?: AnalyticsDateRangeInput,
  ): Promise<PropertyAnalyticsResponse> {
    return this.svc.getPropertyAnalytics(propertyId, ctx.user!.id, dr);
  }

  @Query(() => RevenueAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getRevenueAnalytics(
    @Ctx() ctx: Context,
    @Arg("dateRange", { nullable: true }) dr?: AnalyticsDateRangeInput,
  ): Promise<RevenueAnalyticsResponse> {
    return this.svc.getRevenueAnalyticsPublic(ctx.user!.id, dr);
  }

  @Query(() => BookingAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getBookingAnalytics(
    @Ctx() ctx: Context,
    @Arg("dateRange", { nullable: true }) dr?: AnalyticsDateRangeInput,
  ): Promise<BookingAnalyticsResponse> {
    return this.svc.getBookingAnalyticsPublic(ctx.user!.id, dr);
  }

  @Query(() => MarketInsightsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMarketInsights(
    @Ctx() _ctx: Context,
    @Arg("location", { nullable: true }) _location?: string,
  ): Promise<MarketInsightsResponse> {
    return this.svc.getMarketInsights(_location);
  }
}
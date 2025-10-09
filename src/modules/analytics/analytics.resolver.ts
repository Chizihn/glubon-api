import { Resolver, Query, Arg, Ctx, UseMiddleware } from "type-graphql";
import { Context } from "../../types/context";
import { getContainer } from "../../services";
import { AuthMiddleware, RequireRole } from "../../middleware/auth";
import { RoleEnum } from "@prisma/client";
import { ListerAnalyticsService } from "../../services/lister-analytics";
import {
  ListerAnalyticsResponse,
  PropertyAnalyticsResponse,
  RevenueAnalyticsResponse,
  BookingAnalyticsResponse,
  MarketInsightsResponse,
  AnalyticsDateRangeInput,
  PricePosition,
} from "./analytics.types";

@Resolver()
export class AnalyticsResolver {
  private listerAnalyticsService: ListerAnalyticsService;

  constructor() {
    const container = getContainer();
    this.listerAnalyticsService = container.resolve("listerAnalyticsService");
  }

  @Query(() => ListerAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getListerAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<ListerAnalyticsResponse> {
    const result = await this.listerAnalyticsService.getListerAnalytics(
      ctx.user!.id,
      dateRange
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data!;
  }

  @Query(() => PropertyAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getPropertyAnalytics(
    @Arg("propertyId") propertyId: string,
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<PropertyAnalyticsResponse> {
    const result = await this.listerAnalyticsService.getPropertyAnalytics(
      propertyId,
      ctx.user!.id,
      dateRange
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data!;
  }

  @Query(() => RevenueAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getRevenueAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<RevenueAnalyticsResponse> {
    const { startDate, endDate } = this.parseDateRange(dateRange);

    const result = await this.listerAnalyticsService.getRevenueAnalytics(
      ctx.user!.id,
      startDate,
      endDate
    );

    return result;
  }

  @Query(() => BookingAnalyticsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getBookingAnalytics(
    @Arg("dateRange", { nullable: true }) dateRange: AnalyticsDateRangeInput,
    @Ctx() ctx: Context
  ): Promise<BookingAnalyticsResponse> {
    const { startDate, endDate } = this.parseDateRange(dateRange);

    const result = await this.listerAnalyticsService.getBookingAnalytics(
      ctx.user!.id,
      startDate,
      endDate
    );

    return result;
  }

  @Query(() => MarketInsightsResponse)
  @UseMiddleware(AuthMiddleware, RequireRole(RoleEnum.LISTER))
  async getMarketInsights(
    @Arg("location", { nullable: true }) location: string,
    @Ctx() ctx: Context
  ): Promise<MarketInsightsResponse> {
    // This would require implementing market analysis
    // For now, return mock data structure
    return {
      marketOverview: {
        averagePrice: 0,
        totalListings: 0,
        averageOccupancy: 0,
        priceGrowth: 0,
      },
      priceAnalysis: {
        yourAveragePrice: 0,
        marketAveragePrice: 0,
        pricePosition: PricePosition.AVERAGE,
        recommendedPriceRange: {
          min: 0,
          max: 0,
        },
      },
      demandAnalysis: {
        searchVolume: 0,
        bookingDemand: 0,
        seasonalTrends: [],
        popularAmenities: [],
      },
      competitorAnalysis: {
        directCompetitors: [],
        marketShare: 0,
        competitiveAdvantages: [],
      },
      opportunities: {
        underservedAreas: [],
        pricingOpportunities: [],
        amenityGaps: [],
        marketTrends: [],
      },
    };
  }

  private parseDateRange(dateRange?: AnalyticsDateRangeInput): {
    startDate: Date;
    endDate: Date;
  } {
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

    const endDate = parseDate(dateRange?.endDate) || new Date();
    let startDate: Date;

    const parsedStartDate = parseDate(dateRange?.startDate);
    if (parsedStartDate) {
      startDate = parsedStartDate;
    } else if (dateRange?.period) {
      startDate = new Date(endDate);
      switch (dateRange.period) {
        case "day":
          startDate.setDate(startDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    } else {
      // Default to last 30 days
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }
}

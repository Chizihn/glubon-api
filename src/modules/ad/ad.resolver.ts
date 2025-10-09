import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
import { Ad, AdAnalyticsType, AdType, PaginatedAdResponse } from "./ad.types";
import { PaginationInfo } from "../../types/responses";
import { CreateAdInput, UpdateAdStatusInput, AdAnalyticsFilter, GetAdsFilter } from "./ad.inputs";
import { AdPosition } from "@prisma/client";
import { AuthMiddleware } from "../../middleware";
import { getContainer } from "../../services";
import { AdService } from "../../services/ad";
import { AdAnalyticsService } from "../../services/ad-analytics";

@Resolver(() => Ad)
export class AdResolver {
  private adService: AdService;
  private adAnalyticsService: AdAnalyticsService;

  constructor() {
        const container = getContainer();
    
    this.adService = container.resolve('adService');
    this.adAnalyticsService = container.resolve('adAnalyticsService');
  }

  @Query(() => PaginatedAdResponse)
  @UseMiddleware(AuthMiddleware)
  async getAds(
    @Arg("filter", () => GetAdsFilter, { nullable: true }) filter: GetAdsFilter | null,
    @Ctx() ctx: Context
  ): Promise<PaginatedAdResponse> {
    try {
      console.log('getAds called with filter:', JSON.stringify(filter, null, 2));
      console.log('User context:', { userId: ctx.user?.id });
      
      const result = await this.adService.getAds(filter || undefined);
      console.log('Service result:', { 
        success: result.success, 
        hasData: !!result.data,
        dataLength: result.data?.data?.length,
        message: result.message 
      });
      
      if (!result.success || !result.data) {
        console.error('Failed to get ads:', result.message);
        return {
          data: [],
          pagination: new PaginationInfo(1, 10, 0)
        };
      }
      
      const response = {
        data: result.data.data || [],
        pagination: new PaginationInfo(
          result.data.page || 1,
          result.data.limit || 10,
          result.data.totalItems || 0
        )
      };
      
      console.log('Returning response with', response.data.length, 'ads');
      return response;
      
    } catch (error) {
      console.error('Error in getAds:', error);
      // Log the full error for debugging
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      return {
        data: [],
        pagination: new PaginationInfo(1, 10, 0)
      };
    }
  }

  @Query(() => Ad, { nullable: true })
  @UseMiddleware(AuthMiddleware)
  async getAd(
    @Arg("id", () => String) id: string,
    @Ctx() ctx: Context
  ): Promise<Ad | null> {
    try {
      const result = await this.adService.getAdById(id);
      
      if (!result.success || !result.data) {
        console.error(`[getAd] Failed to fetch ad: ${result.message}`);
        return null;
      }
      
      return result.data;
    } catch (error) {
      return null;
    }
  }

  @Query(() => [Ad])
  async getActiveAds(
    @Arg("position", () => AdPosition, { nullable: true }) position: AdPosition | null,
    @Ctx() ctx: Context
  ): Promise<Ad[]> {
    try {
      const result = await this.adService.getActiveAds(position ?? undefined);
      if (!result.success || !result.data) {
        console.error('Failed to get active ads:', result.message);
        return [];
      }
      return result.data;
    } catch (error) {
      console.error('Error in getActiveAds:', error);
      return [];
    }
  }

  @Query(() => [AdAnalyticsType])
  @UseMiddleware(AuthMiddleware)
  async getAdAnalytics(
    @Arg("filter") filter: AdAnalyticsFilter,
    @Ctx() ctx: Context
  ): Promise<AdAnalyticsType[]> {
    return this.adAnalyticsService.getAnalytics({
      startDate: filter.startDate ?? undefined,
      endDate: filter.endDate ?? undefined,
      adIds: filter.adIds ?? undefined,
      groupByDay: false, // AdAnalyticsType likely expects non-grouped stats
    }).then(result => result.dailyStats); // Extract dailyStats to match AdAnalyticsType[]
  }

  @Mutation(() => Ad)
  @UseMiddleware(AuthMiddleware)
  async createAd(
    @Arg("input") input: CreateAdInput,
    @Ctx() ctx: Context
  ): Promise<Ad> {
    const result = await this.adService.createAd({
      ...input,
      createdBy: ctx.user!.id,
    });
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to create ad');
    }
    return result.data;
  }

  @Mutation(() => Ad)
  @UseMiddleware(AuthMiddleware)
  async updateAdStatus(
    @Arg("input") input: UpdateAdStatusInput,
    @Ctx() ctx: Context
  ): Promise<Ad> {
    const result = await this.adService.updateAdStatus(
      input.id,
      input.status,
      ctx.user!.id
    );
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to update ad status');
    }
    return result.data;
  }

  @Mutation(() => Boolean)
  async recordAdClick(
    @Arg("id") id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    await this.adService.recordAdClick(id);
    return true;
  }

  @Mutation(() => Boolean)
  async recordAdImpression(
    @Arg("id") id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    await this.adService.recordAdImpression(id);
    return true;
  }
}
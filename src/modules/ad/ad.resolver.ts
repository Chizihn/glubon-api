import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
import { Ad, AdAnalyticsType, AdType } from "./ad.types";
import { CreateAdInput, UpdateAdStatusInput, AdAnalyticsFilter } from "./ad.inputs";
import { AdPosition } from "@prisma/client";
import { AuthMiddleware } from "../../middleware";

@Resolver(() => Ad)
export class AdResolver {
  private get adService() {
    if (!this.ctx.services.adService) {
      throw new Error('AdService is not available in the context');
    }
    return this.ctx.services.adService;
  }

  private get adAnalyticsService() {
    if (!this.ctx.services.adAnalyticsService) {
      throw new Error('AdAnalyticsService is not available in the context');
    }
    return this.ctx.services.adAnalyticsService;
  }

  constructor(private ctx: Context) {}

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
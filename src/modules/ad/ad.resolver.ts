import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
import { AdService } from "../../services/ad";
import { AdAnalyticsService } from "../../services/ad-analytics";
import { AuthMiddleware } from "../../middleware";
import { Ad, AdAnalyticsType, AdType } from "./ad.types";
import { CreateAdInput, UpdateAdStatusInput, AdAnalyticsFilter } from "./ad.inputs";
import { AdPosition } from "@prisma/client";

@Resolver(() => Ad)
export class AdResolver {
  constructor(
    private readonly adService: AdService,
    private readonly adAnalyticsService: AdAnalyticsService
  ) {}

  @Query(() => [Ad])
  async getActiveAds(
    @Arg("position", () => AdPosition, { nullable: true }) position: AdPosition | null,
    @Ctx() ctx: Context
  ): Promise<Ad[]> {
    const result = await this.adService.getActiveAds(position ?? undefined);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to get active ads');
    }
    return result.data;
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
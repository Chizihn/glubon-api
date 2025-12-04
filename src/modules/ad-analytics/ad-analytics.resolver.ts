import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
// import { getContainer } from "../../services";
import { AuthMiddleware } from "../../middleware";
import { AdAnalyticsService } from "../../services/ad-analytics";
import { AdAnalyticsSummary } from "./ad-analytics.types";
import { AdAnalyticsFilter, RecordAdInteractionInput } from "./ad-analytics.inputs";

import { Service } from "typedi";

@Service()
@Resolver(() => AdAnalyticsSummary)
export class AdAnalyticsResolver {
  constructor(
    private adAnalyticsService: AdAnalyticsService
  ) {}

  @Query(() => AdAnalyticsSummary)
  @UseMiddleware(AuthMiddleware)
  async getAdAnalytics(
    @Arg("filter") filter: AdAnalyticsFilter,
    @Ctx() ctx: Context
  ): Promise<AdAnalyticsSummary> {
    return this.adAnalyticsService.getAnalytics({
      adIds: filter.adIds ?? undefined,
      startDate: filter.startDate ?? undefined,
      endDate: filter.endDate ?? undefined,
      groupByDay: filter.groupByDay ?? undefined,
    });
  }

  @Mutation(() => Boolean)
  async recordAdInteraction(
    @Arg("input") input: RecordAdInteractionInput,
    @Arg("userId") userId: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    return this.adAnalyticsService.recordInteraction({
      adId: input.adId,
      type: input.type,
      userId: userId ?? ctx.user?.id ?? undefined,
      revenue: input.revenue ?? undefined,
    });
  }
}
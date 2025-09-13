import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types";
import { AdAnalyticsService } from "../../services/ad-analytics";
import { AuthMiddleware } from "../../middleware";
import { AdAnalyticsSummary } from "./ad-analytics.types";
import { AdAnalyticsFilter, RecordAdInteractionInput } from "./ad-analytics.inputs";

@Resolver(() => AdAnalyticsSummary)
export class AdAnalyticsResolver {
  constructor(private readonly adAnalyticsService: AdAnalyticsService) {}

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
import { Field, ObjectType } from 'type-graphql';

@ObjectType()
export class AdAnalyticsType {
  @Field(() => String)
  id?: string;

  @Field(() => String)
  adId?: string;

  @Field(() => Date)
  date: Date;

  @Field(() => Number)
  impressions: number;

  @Field(() => Number)
  clicks: number;

  @Field(() => Number)
  conversions: number;

  @Field(() => Number)
  revenue: number;

  @Field(() => Date)
  createdAt?: Date;
}


@ObjectType()
export class AdAnalyticsSummary {
  @Field(() => Number)
  totalImpressions: number;

  @Field(() => Number)
  totalClicks: number;

  @Field(() => Number)
  totalConversions: number;

  @Field(() => Number)
  totalRevenue: number;

  @Field(() => Number)
  clickThroughRate: number;

  @Field(() => Number)
  conversionRate: number;

  @Field(() => [AdAnalyticsType])
  dailyStats: AdAnalyticsType[];
}



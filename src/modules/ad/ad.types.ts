import { Field, ObjectType, registerEnumType } from 'type-graphql';
import { Ad as PrismaAd, AdPosition, AdStatus, AdType as PrismaAdType } from '@prisma/client';
import { PaginationInfo } from '../../types/responses';

@ObjectType()
export class PaginatedAdResponse {
  @Field(() => [Ad])
  data: Ad[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}

export { AdType } from '@prisma/client';

registerEnumType(AdPosition, {
  name: 'AdPosition',
  description: 'The position where the ad will be displayed',
});

registerEnumType(AdStatus, {
  name: 'AdStatus',
  description: 'The status of the ad',
});

registerEnumType(PrismaAdType, {
  name: 'AdType',
  description: 'The type of ad',
});

@ObjectType()
export class Ad implements PrismaAd {
  @Field(() => String)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => String)
  imageUrl: string;

  @Field(() => String)
  targetUrl: string;

  @Field(() => AdPosition)
  position: AdPosition;

  @Field(() => PrismaAdType)
  type: PrismaAdType;

  @Field(() => AdStatus)
  status: AdStatus;

  @Field(() => Date)
  startDate: Date;

  @Field(() => Date)
  endDate: Date;

  @Field(() => Number, { nullable: true })
  budget: number | null;

  @Field(() => Number, { nullable: true })
  costPerClick: number | null;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => String)
  createdBy: string;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

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

import { Field, InputType, Int } from 'type-graphql';
import { AdPosition, AdType, AdStatus } from '@prisma/client';
import { PaginationInput } from '../../types';
import { SortInput } from '../../types';

@InputType()
export class CreateAdInput {
  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String)
  imageUrl: string;

  @Field(() => String)
  targetUrl: string;

  @Field(() => AdPosition)
  position: AdPosition;

  @Field(() => AdType, { defaultValue: 'STANDARD' })
  type?: AdType;

  @Field(() => Date)
  startDate: Date;

  @Field(() => Date)
  endDate: Date;

  @Field(() => Number, { nullable: true })
  budget?: number;

  @Field(() => Number, { nullable: true })
  costPerClick?: number;
}

@InputType()
export class UpdateAdStatusInput {
  @Field(() => String)
  id: string;

  @Field(() => AdStatus)
  status: AdStatus;
}



@InputType()
export class GetAdsFilter {
  @Field(() => [String], { nullable: true })
  ids?: string[];

  @Field(() => [AdStatus], { nullable: true })
  statuses?: AdStatus[];

  @Field(() => [AdPosition], { nullable: true })
  positions?: AdPosition[];

  @Field(() => [AdType], { nullable: true })
  types?: AdType[];

  @Field(() => Date, { nullable: true })
  startDateAfter?: Date;

  @Field(() => Date, { nullable: true })
  startDateBefore?: Date;

  @Field(() => Date, { nullable: true })
  endDateAfter?: Date;

  @Field(() => Date, { nullable: true })
  endDateBefore?: Date;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => PaginationInput, { nullable: true })
  pagination?: PaginationInput;

  @Field(() => SortInput, { nullable: true })
  sort?: SortInput;
}

@InputType()
export class AdAnalyticsFilter {
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field(() => [String], { nullable: true })
  adIds?: string[];
}

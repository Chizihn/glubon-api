import { Field, InputType } from 'type-graphql';
import { AdPosition, AdType, AdStatus } from '@prisma/client';

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
export class AdAnalyticsFilter {
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field(() => [String], { nullable: true })
  adIds?: string[];
}

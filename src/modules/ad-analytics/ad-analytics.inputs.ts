import { Field, InputType } from 'type-graphql';

@InputType()
export class AdAnalyticsFilter {
  @Field(() => [String], { nullable: true })
  adIds?: string[];
  
  @Field(() => Date, { nullable: true })
  startDate?: Date;
  
  @Field(() => Date, { nullable: true })
  endDate?: Date;
  
  @Field(() => Boolean, { nullable: true })
  groupByDay?: boolean;
}

@InputType()
export class RecordAdInteractionInput {
  @Field(() => String)
  adId: string;
  
  @Field(() => String)
  type: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
  
  @Field(() => Number, { nullable: true })
  revenue?: number;
}

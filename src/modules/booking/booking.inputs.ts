import { Field, GraphQLISODateTime, ID, InputType, Float } from "type-graphql";

@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  propertyId: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date | null;

  @Field(() => String, { nullable: true })
  specialRequests?: string | null;

  @Field(() => [String])
  unitIds: string[];

  @Field(() => Float)
  amount: number;

  @Field(() => [String])
  units: string[];
}

@InputType()
export class CreateBookingRequestInput {
  @Field(() => ID)
  propertyId: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date | null;

  @Field(() => String, { nullable: true })
  specialRequests?: string | null;

  @Field(() => [String])
  unitIds: string[];
}

@InputType()
export class RespondToBookingRequestInput {
  @Field(() => ID)
  bookingId: string;

  @Field()
  accept: boolean;
}
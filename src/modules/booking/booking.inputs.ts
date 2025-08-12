// booking/booking.inputs.ts

import { Field, GraphQLISODateTime, ID, InputType } from "type-graphql";

@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  propertyId: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field({ nullable: true })
  endDate?: Date;

  @Field(() => String, { nullable: true })
  specialRequests?: string | null;
}

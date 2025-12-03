//src/modules/booking/booking.inputs.ts
import { Field, InputType, ID, Int } from "type-graphql";
import { BookingStatus } from "@prisma/client";

@InputType()
export class CreateBookingRequestInput {
  @Field(() => ID)
  propertyId: string;

  @Field(() => [String], { nullable: true })
  unitIds?: string[]; // Optional for properties with units
}

@InputType()
export class CreateBookingInput {
  @Field(() => ID)
  propertyId: string;

  @Field(() => Date)
  startDate: Date;

  @Field(() => Int)
  duration: number; // Number of rental periods (e.g., 2 weeks, 3 months)

  @Field(() => [String], { nullable: true })
  unitIds?: string[]; // Optional for properties with units

  @Field({ nullable: true })
  idempotencyKey?: string;
}

@InputType()
export class RespondToBookingRequestInput {
  @Field(() => ID)
  bookingId: string;

  @Field()
  accept: boolean;
}

@InputType()
export class VerifyPaymentInput {
  @Field()
  reference: string;

  @Field(() => ID)
  userId: string;
}
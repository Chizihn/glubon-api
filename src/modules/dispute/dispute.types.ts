import { Field, ObjectType, InputType, Int, ID, GraphQLISODateTime } from "type-graphql";
import { Booking, Refund } from "../booking/booking.types";
import { User } from "../user/user.types";
import { DisputeStatus } from "@prisma/client";

@ObjectType()
export class Dispute {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  bookingId: string;

  @Field(() => ID)
  initiatorId: string;

  @Field()
  reason: string;

  @Field()
  description: string;

  @Field(() => DisputeStatus)
  status: DisputeStatus;

  @Field()
  resolution: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  resolvedBy?: string | null;

  @Field(() => ID, { nullable: true })
  parentDispute?: string | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Booking)
  booking: Booking;

  @Field(() => User)
  initiator: User;

  @Field(() => [Refund], { nullable: true })
  refunds?: Refund[];

  @Field(() => Dispute, { nullable: true })
  parent?: Dispute;

  @Field(() => [Dispute], { nullable: true })
  children?: Dispute[];
}

@ObjectType()
export class PaginatedDisputes {
  @Field(() => [Dispute])
  data!: Dispute[];

  @Field(() => PaginationMeta)
  meta!: PaginationMeta;
}

@ObjectType()
export class PaginationMeta {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;

  @Field(() => Int)
  totalPages!: number;
}

@InputType()
export class DisputeFilterInput {
  @Field({ nullable: true })
  initiatorId?: string;

  @Field({ nullable: true })
  bookingId?: string;

  @Field({ nullable: true })
  startDate?: Date;

  @Field({ nullable: true })
  endDate?: Date;
}

import { Field, ObjectType, InputType, Int, ID, GraphQLISODateTime, registerEnumType } from "type-graphql";
import { Booking, Refund } from "../booking/booking.types";
import { User } from "../user/user.types";
import { DisputeStatus } from "@prisma/client";
import { PaginationMeta } from "../../types";

registerEnumType(DisputeStatus, {
  name: "DisputeStatus",
  description:
    "The status of dispute",
});

@ObjectType()
export class Dispute {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  bookingId: string;

  @Field(() => ID)
  initiatorId: string;

  @Field(() => String)
  reason: string;

  @Field(() => String)
  description: string;

  @Field(() => DisputeStatus)
  status: DisputeStatus;

  @Field(() => String)
  resolution: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  resolvedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  resolvedBy?: string | null;

  @Field(() => ID, { nullable: true })
  parentDispute?: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
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


@InputType()
export class DisputeFilterInput {
  @Field(() => String, { nullable: true })
  initiatorId?: string;

  @Field(() => String, { nullable: true })
  bookingId?: string;

  @Field(() => String, { nullable: true })
  startDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;
}

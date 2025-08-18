import { DisputeStatus } from "@prisma/client";
import { Field, ID, InputType, Int, registerEnumType } from "type-graphql";

registerEnumType(DisputeStatus, {
  name: "DisputeStatus",
  description:
    "The status of dispute",
});

@InputType()
export class CreateDisputeInput {
  @Field(() => ID)
  bookingId: string;

  @Field(() => String)
  reason: string;

  @Field(() => String)
  description: string;

  @Field(() => [String])
  evidence: string[];
}

@InputType()
export class ResolveDisputeInput {
  @Field(() => ID)
  disputeId: string;

  @Field(() => DisputeStatus)
  status: DisputeStatus;

  @Field(() => String)
  resolution: string;

  @Field(() => Int)
  refundAmount?: number | null;
}

@InputType()
export class CreateRefundInput {
  @Field(() => ID)
  transactionId: string;

  @Field(() => ID)
  disputeId: string;

  @Field(() => Int)
  amount: number;

  @Field(() => String)
  reason: string;
}

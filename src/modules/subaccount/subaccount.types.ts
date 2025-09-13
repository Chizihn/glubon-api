import {
  ObjectType,
  Field,
  ID,
  Float,
  Int,
  registerEnumType,
  GraphQLISODateTime,
} from "type-graphql";
import { SubaccountStatus } from "@prisma/client";

registerEnumType(SubaccountStatus, {
  name: "SubaccountStatus",
  description: "Status of the subaccount",
});

@ObjectType()
export class Subaccount {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => String, { nullable: true })
  subaccountCode: string | null;

  @Field()
  businessName: string;

  @Field()
  accountNumber: string;

  @Field()
  bankCode: string;

  @Field(() => String, { nullable: true })
  accountName: string | null;

  @Field(() => Float)
  percentageCharge: number;

  @Field(() => SubaccountStatus)
  status: SubaccountStatus;

  @Field(() => String, { nullable: true })
  paystackSubaccountId: string | null;

  @Field()
  isActive: boolean;

  @Field(() => String, { nullable: true })
  failureReason: string | null;

  @Field(() => Int)
  retryCount: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastRetryAt: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class Bank {
  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  code: string;

  @Field()
  longcode: string;

  @Field()
  gateway: string;

  @Field()
  payWithBank: boolean;

  @Field()
  active: boolean;

  @Field()
  country: string;

  @Field()
  currency: string;

  @Field()
  type: string;
}

@ObjectType()
export class AccountDetails {
  @Field()
  accountNumber: string;

  @Field()
  accountName: string;

  @Field()
  bankCode: string;
}

@ObjectType()
export class SubaccountResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => Subaccount, { nullable: true })
  data?: Subaccount;
}

@ObjectType()
export class BankListResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => [Bank])
  data: Bank[];
}

@ObjectType()
export class AccountResolveResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => AccountDetails, { nullable: true })
  data?: AccountDetails;
}

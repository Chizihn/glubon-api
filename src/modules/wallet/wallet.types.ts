import { GraphQLJSONObject } from "graphql-type-json";
import { Field, Float, GraphQLISODateTime, ID, InputType, Int, ObjectType, registerEnumType } from "type-graphql";
import {  TransactionType, TransactionStatus, WalletTransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

registerEnumType(TransactionType, {
  name: 'TransactionType',
  description: 'The type of transaction',
});

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
  description: 'The status of a transaction',
});

registerEnumType(WalletTransactionType, { name: "WalletTransactionType", description: "The type of wallet transaction" });


@ObjectType()
export class Wallet {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Float)
  balance: number;

  @Field()
  currency: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => [WalletTransaction], { nullable: true })
  walletTransactions?: WalletTransaction[];
}

@ObjectType()
export class WalletTransaction {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  walletId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => WalletTransactionType)
  type: WalletTransactionType;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field(() => String)
  reference: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  relatedTransactionId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}

@ObjectType()
export class PaginatedWalletTransactions {
  @Field(() => [WalletTransaction])
  transactions!: WalletTransaction[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Boolean)
  hasMore!: boolean;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  limit!: number;
}

@InputType()
export class WalletTransactionFilterInput {
  @Field(() => [TransactionType], { nullable: true })
  types?: TransactionType[];

  @Field(() => [TransactionStatus], { nullable: true })
  statuses?: TransactionStatus[];

  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;

  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;
}



@InputType()
export class RequestWithdrawalInput {
  @Field(() => Float)
  amount: number;

  @Field(() => String)
  paymentMethod: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  details?: string;
}

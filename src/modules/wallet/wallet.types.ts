import { GraphQLJSONObject } from "graphql-type-json";
import { Field, Float, GraphQLISODateTime, ID, InputType, Int, ObjectType, registerEnumType } from "type-graphql";
import { TransactionType, TransactionStatus } from "@prisma/client";

registerEnumType(TransactionType, {
  name: 'TransactionType',
  description: 'The type of transaction',
});

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
  description: 'The status of a transaction',
});

@ObjectType()
export class Transaction {
  @Field(() => ID)
  id: string;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field()
  reference: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  propertyId?: string;

  @Field(() => ID, { nullable: true })
  bookingId?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: any;

  @Field(() => String, { nullable: true })
  paymentMethod?: string;

  @Field(() => String, { nullable: true })
  gatewayRef?: string;

  @Field(() => String, { nullable: true })
  failureReason?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  processedAt?: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class PaginatedTransactions {
  @Field(() => [Transaction])
  transactions: Transaction[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => Boolean)
  hasMore: boolean;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@InputType()
export class TransactionFilterInput {
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
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;
}

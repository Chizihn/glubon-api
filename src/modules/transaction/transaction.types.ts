import { TransactionStatus, TransactionType, PaymentGateway } from "@prisma/client";
import { Field, ObjectType, InputType, registerEnumType, Float, GraphQLISODateTime, Int, ID } from "type-graphql";
import { User } from "../user/user.types";
import { Property } from "../property/property.types";
import { Booking, Refund } from "../booking/booking.types";
import { Decimal } from "@prisma/client/runtime/library";

// Register enums with TypeGraphQL
registerEnumType(TransactionType, {
  name: "TransactionType",
  description: "The type of transaction"
});

registerEnumType(TransactionStatus, {
  name: "TransactionStatus",
  description: "The status of a transaction"
});

registerEnumType(PaymentGateway, {
  name: "PaymentGateway",
  description: "The payment gateway used for the transaction"
});

// Base transaction type with common fields
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

  @Field()
  description: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  propertyId?: string;

  @Field(() => ID, { nullable: true })
  adId?: string;

  @Field(() => ID, { nullable: true })
  bookingId?: string;

  @Field(() => String, { nullable: true })
  metadata?: any;

  @Field({ nullable: true })
  paymentMethod?: string;

  @Field(() => PaymentGateway, { nullable: true })
  gateway?: PaymentGateway;

  @Field({ nullable: true })
  gatewayRef?: string;

  @Field({ nullable: true })
  failureReason?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Property, { nullable: true })
  property?: Property;

  //   @Field(() => Ad, { nullable: true })
  //   ad?: Ad;

  @Field(() => Booking, { nullable: true })
  booking?: Booking;

  @Field(() => [Refund], { nullable: true })
  refunds?: Refund[];
}

// Transaction statistics
@ObjectType()
export class TransactionStats {
  @Field(() => Int)
  totalTransactions!: number;

  @Field(() => Int)
  totalAmount!: number;

  @Field(() => Int)
  pendingTransactions!: number;

  @Field(() => Int)
  completedTransactions!: number;

  @Field(() => Int)
  failedTransactions!: number;
}


// Paginated transactions response
@ObjectType()
export class PaginatedTransactions {
  @Field(() => [Transaction])
  transactions!: Transaction[];

  @Field(() => Int)
  totalCount!: number;

  @Field(() => Boolean)
  hasMore!: boolean;

  @Field(() => TransactionStats, { nullable: true })
  stats?: TransactionStats;
}


// Transaction filter input
@InputType()
export class TransactionFilterInput {
  @Field(() => [TransactionType], { nullable: true })
  types?: TransactionType[];

  @Field(() => [TransactionStatus], { nullable: true })
  statuses?: TransactionStatus[];

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID,{ nullable: true })
  propertyId?: string;

  @Field(() => ID,{ nullable: true })
  bookingId?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date;

  @Field(() => GraphQLISODateTime,{ nullable: true })
  endDate?: Date;

  @Field(() => Float, { nullable: true })
  minAmount?: Decimal;

  @Field(() => Float,{ nullable: true })
  maxAmount?: Decimal;
}

// Transaction sort input
@InputType()
export class TransactionSortInput {
  @Field(() => String, { defaultValue: "createdAt" })
  field!: "createdAt" | "amount" | "status";

  @Field(() => String, { defaultValue: "DESC" })
  order!: "ASC" | "DESC";
}

// Pagination input
@InputType()
export class PaginationInput {
  @Field(() => Int,{ defaultValue: 1 })
  page!: number;

  @Field(() => Int,{ defaultValue: 10 })
  limit!: number;
}

// Verify transaction response
@ObjectType()
export class VerifyTransactionResponse {
  @Field(() => Boolean)
  status!: boolean;

  @Field(() => String)
  message!: string;

  @Field(() => Transaction, { nullable: true })
  transaction?: Transaction;
}

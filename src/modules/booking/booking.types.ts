import {
  ObjectType,
  Field,
  ID,
  Float,
  Int,
  registerEnumType,
  GraphQLISODateTime,
} from "type-graphql";
import {
  BookingStatus,
  DisputeStatus,
  RefundStatus,
  TransactionStatus,
  TransactionType,
  WalletTransactionType,
  PaymentGateway,
} from "@prisma/client";
import { User } from "../user/user.types";
import { Property } from "../property/property.types";
import { Dispute } from "../dispute/dispute.types";
import { Transaction } from "../transaction/transaction.types";

// Register enums for GraphQL
registerEnumType(BookingStatus, { name: "BookingStatus" });
registerEnumType(DisputeStatus, { name: "DisputeStatus" });
registerEnumType(WalletTransactionType, { name: "WalletTransactionType" });
registerEnumType(TransactionStatus, { name: "TransactionStatus" });
registerEnumType(TransactionType, { name: "TransactionType" });
registerEnumType(RefundStatus, { name: "RefundStatus" });
registerEnumType(PaymentGateway, { name: "PaymentGateway" });

@ObjectType()
export class BookingUnit {

}

@ObjectType()
export class Booking {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  renterId: string;

  @Field(() => ID)
  propertyId: string;

  @Field(() => GraphQLISODateTime)
  startDate: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date | null;

  @Field(() => GraphQLISODateTime)
  requestedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  respondedAt?: Date | null;

  @Field(() => Float)
  amount: number;

  @Field(() => BookingStatus)
  status: BookingStatus;

  @Field(() => GraphQLISODateTime,)
  createdAt: Date;

  @Field(() => GraphQLISODateTime,)
  updatedAt: Date;

  @Field(() => User, { nullable: true })
  renter?: User;  

  @Field(() => Property, { nullable: true })
  property?: Property;

  @Field(() => [Transaction], { nullable: true })
  transactions?: Transaction[];

  @Field(() => [Dispute], { nullable: true })
  disputes?: Dispute[];

  @Field(() => [String], { nullable: true })
  unitIds?: string[];
  
}

@ObjectType()
export class Refund {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  transactionId: string;

  @Field(() => ID, { nullable: true })
  disputeId?: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  reason: string;

  @Field(() => RefundStatus)
  status: RefundStatus;

  @Field(() => ID, { nullable: true })
  processedBy?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => Transaction)
  transaction: Transaction;

  @Field(() => Dispute, { nullable: true })
  dispute?: Dispute;

  @Field(() => User, { nullable: true })
  processor?: User;
}

@ObjectType()
export class BookingResponse {
  @Field(() => Booking, { nullable: true })
  booking?: Booking;

  @Field(() => String,{ nullable: true })
  message?: string;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  paymentUrl?: string;
}

@ObjectType()
export class BookingRequestResponse {
  @Field(() => Booking, { nullable: true })
  booking?: Booking;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String, { nullable: true })
  message?: string;

}

@ObjectType()
export class PaginationInfo {
  @Field(() => Int)
  currentPage: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int)
  totalItems: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;

  @Field(() => Int)
  limit: number;
}

@ObjectType()
export class PaginatedBookingsResponse {
  @Field(() => [Booking])
  items: Booking[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  @Field(() => Int)
  totalCount: number;

  @Field(() => Boolean)
  success: boolean;

  
}
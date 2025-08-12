import {
  ObjectType,
  Field,
  ID,
  Float,
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
import { PaginatedResponse } from "../../types";
import { Dispute } from "../dispute/dispute.types";

// Register enums for GraphQL
registerEnumType(BookingStatus, { name: "BookingStatus" });
registerEnumType(DisputeStatus, { name: "DisputeStatus" });
registerEnumType(WalletTransactionType, { name: "WalletTransactionType" });
registerEnumType(TransactionStatus, { name: "TransactionStatus" });
registerEnumType(TransactionType, { name: "TransactionType" });
registerEnumType(RefundStatus, { name: "RefundStatus" });
registerEnumType(PaymentGateway, { name: "PaymentGateway" });

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

  @Field()
  reference: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID, { nullable: true })
  relatedTransactionId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
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
  endDate?: Date;

  @Field(() => Float)
  amount: number;

  @Field(() => BookingStatus)
  status: BookingStatus;

  @Field(() => ID, { nullable: true })
  escrowTransactionId?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => User)
  renter: User;

  @Field(() => Property)
  property: Property;

  @Field(() => [Transaction])
  transactions: Transaction[];

  @Field(() => [Dispute], { nullable: true })
  disputes?: Dispute[];
}



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

  @Field()
  reason: string;

  @Field(() => RefundStatus)
  status: RefundStatus;

  @Field(() => ID, { nullable: true })
  processedBy?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field()
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
  @Field(() => Booking)
  booking: Booking;

  @Field(() => String)
  paymentUrl: string;

  @Field(() => Boolean)
  success: boolean;
}

@ObjectType()
export class PaginatedBookingsResponse extends PaginatedResponse<Booking> {
  @Field(() => [Booking])
  declare items: Booking[];

  @Field(() => String)
  paymentUrl: string;

  @Field(() => Boolean)
  success: boolean;
}

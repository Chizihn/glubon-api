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

import { InputType, Field, Float, ID } from 'type-graphql';
import { TransactionType, TransactionStatus, PaymentGateway } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { GraphQLJSONObject } from 'graphql-type-json';

@InputType()
export class CreateTransactionInput {
  @Field(() => TransactionType)
  type!: TransactionType;

  @Field(() => Float)
  amount!: Decimal;

  @Field(() => String, { defaultValue: 'NGN' })
  currency!: string;

  @Field(() => String)
  description!: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  propertyId?: string;

  @Field(() => ID, { nullable: true })
  bookingId?: string;

  @Field(() => ID, { nullable: true })
  adId?: string;

  @Field(() => String, { nullable: true })
  paymentMethod?: string;

  @Field(() => PaymentGateway, { nullable: true })
  gateway?: PaymentGateway;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: any;
}

@InputType()
export class UpdateTransactionStatusInput {
  @Field(() => ID)
  transactionId!: string;

  @Field(() => TransactionStatus)
  status!: TransactionStatus;

  @Field(() => String, { nullable: true })
  gatewayRef?: string;

  @Field(() => String, { nullable: true })
  failureReason?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: any;
}

@InputType()
export class VerifyTransactionInput {
  @Field(() => String)
  reference!: string;
}

@InputType()
export class InitiatePaymentInput {
  @Field(() => String)
  email!: string;

  @Field(() => Float)
  amount!: Decimal;

  @Field(() => String)
  currency!: string;

  @Field(() => String)
  callbackUrl!: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  metadata?: any;
}

@InputType()
export class InitiateWithdrawalInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => Float)
  amount!: Decimal;

  @Field(() => String)
  bankCode!: string;

  @Field(() => String)
  accountNumber!: string;

  @Field(() => String, { nullable: true })
  accountName?: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class ProcessWithdrawalInput {
  @Field(() => ID)
  withdrawalId!: string;

  @Field(() => String)
  status!: 'approved' | 'rejected';

  @Field(() => ID, { nullable: true })
  adminId?: string;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class GenerateTransactionReportInput {
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field(() => [TransactionType], { nullable: true })
  types?: TransactionType[];

  @Field(() => [TransactionStatus], { nullable: true })
  statuses?: TransactionStatus[];

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  propertyId?: string;

  @Field(() => ID, { nullable: true })
  bookingId?: string;
}

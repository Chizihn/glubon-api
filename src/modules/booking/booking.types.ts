//src/modules/booking/booking.types.ts
import {
  ObjectType,
  Field,
  ID,
  Int,
  registerEnumType,
  GraphQLISODateTime,
} from "type-graphql";
import { BookingStatus, RoleEnum } from "@prisma/client";
import { User } from "../user/user.types";
import { Property } from "../property/property.types";
import { Transaction } from "../transaction/transaction.types";
import { GraphQLDecimal } from "../../graphql/scalars/Decimal";
import { Decimal } from "@prisma/client/runtime/library";
import { PaginationInfo } from "../../types";

registerEnumType(BookingStatus, { name: "BookingStatus" });

@ObjectType()
export class BookingUnit {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  bookingId: string;

  @Field(() => ID)
  unitId: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType()
export class Booking {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  renterId: string;

  @Field(() => ID)
  propertyId: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  respondedAt?: Date | null;

  @Field(() => GraphQLDecimal)
  amount: Decimal;

  @Field(() => BookingStatus)
  status: BookingStatus;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  // Relations
  @Field(() => User, { nullable: true })
  renter?: User;

  @Field(() => Property, { nullable: true })
  property?: Property;

  @Field(() => [Transaction], { nullable: true })
  transactions?: Transaction[];

  @Field(() => [BookingUnit], { nullable: true })
  units?: BookingUnit[];
}

@ObjectType()
export class BookingResponse {
  @Field(() => Booking, { nullable: true })
  booking?: Booking;

  @Field(() => String, { nullable: true })
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
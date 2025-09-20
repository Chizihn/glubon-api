import {
  ObjectType,
  Field,
  ID,
  Int,
  Float,
  GraphQLISODateTime,
  registerEnumType,
  InputType,
  ArgsType,
} from "type-graphql";
import { UnitStatus, RoomType, RentalPeriod } from "@prisma/client";
import { PaginationInfo } from "../../types";

// Register enums
registerEnumType(UnitStatus, {
  name: "UnitStatus",
  description: "Status of the unit",
});

registerEnumType(RoomType, {
  name: "RoomType",
  description: "Type of room",
});

registerEnumType(RentalPeriod, {
  name: "RentalPeriod",
  description: "Rental period for the unit",
});

@ObjectType()
export class Unit {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  propertyId: string;

  @Field(() => String, { nullable: true })
  renterId?: string | null;

  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  amount: number;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field(() => Float, { nullable: true })
  sqft?: number;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => RoomType)
  roomType: RoomType;

  @Field(() => [String])
  amenities: string[];

  @Field(() => Boolean)
  isFurnished: boolean;

  @Field(() => Boolean)
  isForStudents: boolean;

  @Field(() => UnitStatus)
  status: UnitStatus;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class UnitCounts {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  available: number;

  @Field(() => Int)
  rented: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  inactive: number;
}

@ObjectType()
export class PaginatedUnitsResponse {
  @Field(() => [Unit])
  units: Unit[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}

// Input Types for property owners
@InputType()
export class CreateUnitInput {
  @Field(() => String, { nullable: true })
  title?: string | null;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  amount: number;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field(() => Float, { nullable: true })
  sqft?: number;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => RoomType)
  roomType: RoomType;

  @Field(() => [String], { defaultValue: [] })
  amenities: string[];

  @Field(() => Boolean, { defaultValue: false })
  isFurnished: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isForStudents: boolean;
}

@InputType()
export class UpdateUnitInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  amount?: number;

  @Field(() => RentalPeriod, { nullable: true })
  rentalPeriod?: RentalPeriod;

  @Field(() => Float, { nullable: true })
  sqft?: number;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => RoomType, { nullable: true })
  roomType?: RoomType;

  @Field(() => [String], { nullable: true })
  amenities?: string[];

  @Field(() => Boolean, { nullable: true })
  isFurnished?: boolean;

  @Field(() => Boolean, { nullable: true })
  isForStudents?: boolean;
}

@ArgsType()
export class GetUnitsArgs {
  @Field(() => String)
  propertyId: string;

  @Field(() => UnitStatus, { nullable: true })
  status?: UnitStatus;

  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 20 })
  limit: number;
}

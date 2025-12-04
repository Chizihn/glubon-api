//src/modules/property/property.simple.inputs.ts
import {
  PropertyStatus,
  PropertyType,
  PropertyListingType,
  RentalPeriod,
  RoomType,
  DayOfWeek,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { FileUpload, GraphQLUpload } from "graphql-upload-ts";
import { Field, InputType, Int, Float } from "type-graphql";
import { NigerianState } from "../../types/enums";

@InputType()
export class SimpleCreatePropertyInput {
  @Field(() => String)
  title: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  amount: Decimal;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field(() => String)
  address: string;

  @Field(() => String)
  city: string;

  @Field(() => NigerianState)
  state: NigerianState;

  @Field(() => Float, { nullable: true })
  sqft?: number | null;

  @Field(() => Int, { nullable: true })
  bedrooms?: number | null;

  @Field(() => Int, { nullable: true })
  bathrooms?: number | null;

  @Field(() => PropertyType)
  propertyType: PropertyType;

  @Field(() => RoomType)
  roomType: RoomType;

  @Field(() => Boolean, { defaultValue: false })
  isFurnished: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isForStudents: boolean;

  @Field(() => [DayOfWeek])
  visitingDays: DayOfWeek[];

  @Field(() => String, { nullable: true })
  visitingTimeStart?: string | null;

  @Field(() => String, { nullable: true })
  visitingTimeEnd?: string | null;

  @Field(() => [String])
  amenities: string[];

  @Field(() => PropertyListingType, { defaultValue: "RENT" })
  listingType: PropertyListingType;

  // Simple unit management - hidden complexity
  @Field(() => Int, {
    nullable: true,
    description: "Number of identical units (for apartment buildings)",
  })
  numberOfUnits?: number;

  @Field(() => [GraphQLUpload], { nullable: true })
  files?: FileUpload[];
}

@InputType()
export class SimpleUpdatePropertyInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float, { nullable: true })
  amount?: Decimal | null;

  @Field(() => RentalPeriod, { nullable: true })
  rentalPeriod?: RentalPeriod | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => NigerianState, { nullable: true })
  state?: NigerianState | null;

  @Field(() => Float, { nullable: true })
  sqft?: number | null;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => PropertyType, { nullable: true })
  propertyType?: PropertyType;

  @Field(() => RoomType, { nullable: true })
  roomType?: RoomType;

  @Field(() => Boolean, { nullable: true })
  isFurnished?: boolean;

  @Field(() => Boolean, { nullable: true })
  isForStudents?: boolean;

  @Field(() => [DayOfWeek], { nullable: true })
  visitingDays?: DayOfWeek[];

  @Field(() => String, { nullable: true })
  visitingTimeStart?: string;

  @Field(() => String, { nullable: true })
  visitingTimeEnd?: string;

  @Field(() => [String], { nullable: true })
  amenities?: string[];

  @Field(() => PropertyListingType, { nullable: true })
  listingType?: PropertyListingType;

  @Field(() => Int, {
    nullable: true,
    description: "Number of identical units (for apartment buildings)",
  })
  numberOfUnits?: number;

  @Field(() => [GraphQLUpload], { nullable: true })
  files?: FileUpload[];
}

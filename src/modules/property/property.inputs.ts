//src/modules/property/property.inputs.ts
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
export class PropertyFilters {
  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => PropertyStatus, { nullable: true })
  status?: PropertyStatus;

  @Field(() => PropertyType, { nullable: true })
  propertyType?: PropertyType;

  @Field(() => RoomType, { nullable: true })
  roomType?: RoomType;

  @Field(() => PropertyListingType, { nullable: true })
  listingType?: PropertyListingType;

  @Field(() => RentalPeriod, { nullable: true })
  rentalPeriod?: RentalPeriod;

  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => NigerianState, { nullable: true })
  state?: NigerianState;

  @Field(() => Boolean, { nullable: true })
  isFurnished?: boolean;

  @Field(() => Boolean, { nullable: true })
  isForStudents?: boolean;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => Float, { nullable: true })
  radiusKm?: number;

  @Field(() => [String], { nullable: true })
  amenities?: string[];

  @Field(() => [DayOfWeek], { nullable: true })
  visitingDays?: DayOfWeek[];
}

@InputType()
export class PropertySortOptions {
  @Field(() => String, { defaultValue: "createdAt" })
  field: string;

  @Field(() => String, { defaultValue: "desc" })
  direction: "asc" | "desc";
}

@InputType()
export class PropertyUnitInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string;

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
export class BulkUnitInput {
  @Field(() => String)
  unitTitle: string;

  @Field(() => Int)
  unitCount: number;

  @Field(() => PropertyUnitInput)
  unitDetails: PropertyUnitInput;
}

@InputType()
export class CreatePropertyInput {
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

  @Field(() => Boolean, { defaultValue: false })
  isStandalone: boolean;

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

  // Unit creation options
  @Field(() => [PropertyUnitInput], { nullable: true })
  units?: PropertyUnitInput[];

  @Field(() => BulkUnitInput, { nullable: true })
  bulkUnits?: BulkUnitInput;

  @Field(() => [GraphQLUpload], { nullable: true })
  files?: FileUpload[];
}

@InputType()
export class UpdatePropertyUnitInput {
  @Field(() => String, { nullable: true })
  id?: string; // If provided, update existing unit; otherwise create new

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

@InputType()
export class UpdatePropertyInput {
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

  // Unit update options
  @Field(() => [UpdatePropertyUnitInput], { nullable: true })
  units?: UpdatePropertyUnitInput[];

  @Field(() => BulkUnitInput, { nullable: true })
  bulkUnits?: BulkUnitInput;

  @Field(() => [GraphQLUpload], { nullable: true })
  files?: FileUpload[];
}

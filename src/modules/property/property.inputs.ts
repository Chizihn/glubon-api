import {
  PropertyStatus,
  PropertyType,
  RentalPeriod,
  RoomType,
  DayOfWeek,
} from "@prisma/client";
import { Field, InputType, Int, Float } from "type-graphql";

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

  @Field(() => String, { nullable: true })
  state?: string;

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
export class CreatePropertyInput {
  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float)
  amount: number;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field()
  address: string;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field(() => Float, { nullable: true })
  sqft?: number | null;

  @Field(() => Int)
  bedrooms: number;

  @Field(() => Int)
  bathrooms: number;

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
}

@InputType()
export class UpdatePropertyInput {
  @Field(() => String)
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Float, { nullable: true })
  amount?: number | null;

  @Field(() => RentalPeriod, { nullable: true })
  rentalPeriod?: RentalPeriod | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  state?: string | null;

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
}

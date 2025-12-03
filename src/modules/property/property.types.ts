//src/modules/property/property.types.ts
import {
  ArgsType,
  Field,
  ObjectType,
  InputType,
  Int,
  Float,
  registerEnumType,
  GraphQLISODateTime,
  ID,
} from "type-graphql";
import {
  PropertyStatus,
  PropertyType,
  RentalPeriod,
  RoomType,
  DayOfWeek,
  PropertyListingType,
} from "@prisma/client";
import { User } from "../user/user.types";
import { PaginationInfo } from "../../types";
import { MapSearchInput } from "./property.map.inputs";

@ObjectType()
export class MapSearchResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => [Property], { nullable: true })
  data?: any[]; // Using any[] to handle the service response type

  @Field(() => String, { nullable: true })
  message?: string;

  @Field(() => Int, { nullable: true })
  total?: number;
}

@InputType()
export class MyPropertiesFilterInput {
  @Field(() => PropertyStatus, { nullable: true })
  status?: PropertyStatus;

  @Field(() => PropertyType, { nullable: true })
  propertyType?: PropertyType;

  @Field(() => PropertyListingType, { nullable: true })
  listingType?: PropertyListingType;

  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;

  @Field(() => Date, { nullable: true })
  createdAfter?: Date;

  @Field(() => Date, { nullable: true })
  createdBefore?: Date;

  @Field(() => Date, { nullable: true })
  updatedAfter?: Date;
}

@ArgsType()
export class GetMyPropertiesArgs {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 20 })
  limit: number;

  @Field(() => MyPropertiesFilterInput, { nullable: true })
  filter?: MyPropertiesFilterInput;
}

registerEnumType(PropertyType, {
  name: "PropertyType",
  description: "Type of property (e.g., Apartment, House, etc.)",
});

registerEnumType(RoomType, {
  name: "RoomType",
  description: "Type of room (e.g., Single, Shared, etc.)",
});

registerEnumType(PropertyStatus, {
  name: "PropertyStatus",
  description: "Status of the property (e.g., Available, Rented, etc.)",
});

registerEnumType(RentalPeriod, {
  name: "RentalPeriod",
  description: "Rental period for the property (e.g., Daily, Monthly)",
});

registerEnumType(PropertyListingType, {
  name: "PropertyListingType",
  description: "Listing type (e.g., RENT, SALE)",
});

registerEnumType(DayOfWeek, {
  name: "DayOfWeek",
  description: "Days of the week for property visits",
});
@InputType()
export class PropertyFilterInput {
  @Field(() => Float, { nullable: true })
  minAmount?: number;

  @Field(() => Float, { nullable: true })
  maxAmount?: number;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => PropertyType, { nullable: true })
  propertyType?: PropertyType;

  @Field(() => RoomType, { nullable: true })
  roomType?: RoomType;

  @Field(() => PropertyListingType, { nullable: true })
  listingType?: PropertyListingType;

  @Field(() => Boolean, { nullable: true })
  isFurnished?: boolean;

  @Field(() => Boolean, { nullable: true })
  isForStudents?: boolean;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  state?: string;

  @Field(() => [String], { nullable: true })
  amenities?: string[];

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => Float, { nullable: true })
  radiusKm?: number;

  @Field(() => PropertyStatus, { nullable: true })
  status?: PropertyStatus;

  @Field(() => String, { nullable: true })
  search?: string;
}

@ArgsType()
export class GetPropertiesArgs {
  @Field(() => PropertyFilterInput, { nullable: true })
  filter?: PropertyFilterInput;

  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => String, { nullable: true })
  sortOrder?: string;

  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 20 })
  limit: number;
}

@ObjectType()
export class PropertyUnit {
  @Field(() => ID)
  id: string;

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

  @Field(() => [String])
  amenities: string[];

  @Field(() => Boolean)
  isFurnished: boolean;

  @Field(() => Boolean)
  isForStudents: boolean;

  @Field(() => String)
  status: string;

  @Field(() => String, { nullable: true })
  renterId?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class Property {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => PropertyStatus)
  status: PropertyStatus;

  @Field(() => PropertyListingType)
  listingType: PropertyListingType;

  @Field(() => Float)
  amount: number;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field(() => String)
  address: string;

  @Field(() => String)
  city: string;

  @Field(() => String)
  state: string;

  @Field(() => String, { defaultValue: "Nigeria" })
  country: string;

  @Field(() => Float, { nullable: true })
  latitude: number | null;

  @Field(() => Float, { nullable: true })
  longitude: number | null;

  @Field(() => Float, { nullable: true })
  sqft: number | null;

  @Field(() => Int)
  bedrooms: number;

  @Field(() => Int)
  bathrooms: number;

  @Field(() => PropertyType)
  propertyType: PropertyType;

  @Field(() => RoomType)
  roomType: RoomType;

  @Field(() => [DayOfWeek])
  visitingDays: DayOfWeek[];

  @Field(() => String, { nullable: true })
  visitingTimeStart: string | null;

  @Field(() => String, { nullable: true })
  visitingTimeEnd: string | null;

  @Field(() => [String])
  amenities: string[];

  @Field(() => Boolean, { defaultValue: false })
  isFurnished: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isForStudents: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isStandalone: boolean;

  @Field(() => Int, { nullable: true })
  totalUnits: number | null;

  @Field(() => Int, { nullable: true })
  availableUnits: number | null;

  @Field(() => Int, { nullable: true })
  rentedUnits: number | null;

  @Field(() => [String])
  images: string[];

  @Field(() => [String], { defaultValue: [],nullable: true })
  sampleUnitImages: string[];

  @Field(() => [String], { defaultValue: [] })
  livingRoomImages: string[];

  @Field(() => [String], { defaultValue: [] })
  bedroomImages: string[];

  @Field(() => [String], { defaultValue: [] })
  bathroomImages: string[];

  @Field(() => String, { nullable: true })
  video: string | null;

  @Field(() => [String])
  propertyOwnershipDocs: string[];

  @Field(() => [String])
  propertyPlanDocs: string[];

  @Field(() => [String])
  propertyDimensionDocs: string[];

  @Field(() => Boolean, { defaultValue: false })
  featured: boolean;

  @Field(() => String)
  ownerId: string;

  @Field(() => User)
  owner: User;

  @Field(() => Int, { defaultValue: 0 })
  viewsCount: number;

  @Field(() => Int, { defaultValue: 0 })
  likesCount: number;

  // Simplified unit information - hide complexity
  @Field(() => Int, {
    nullable: true,
    description: "Number of units in this property",
  })
  numberOfUnits?: number;

  @Field(() => Boolean, { defaultValue: false })
  isLiked: boolean;

  @Field(() => Boolean, { defaultValue: false })
  isViewed: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  // Computed fields
  @Field(() => String, { nullable: true })
  get location(): string {
    return `${this.address}, ${this.city}, ${this.state}, ${this.country}`;
  }

  @Field(() => String, { nullable: true })
  get priceUnit(): string {
    return "NGN"; // Default currency
  }

  @Field(() => String, { nullable: true })
  get pricePer(): string {
    return this.rentalPeriod?.toLowerCase() || "month";
  }

  @Field(() => String, { nullable: true })
  get imageUrl(): string | null {
    return this.images?.[0] || null;
  }

  @Field(() => String, { nullable: true })
  get type(): string | null {
    return this.propertyType?.toLowerCase() || null;
  }
}

@ObjectType()
export class PaginatedPropertiesResponse {
  @Field(() => [Property])
  properties: Property[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}

@ObjectType()
export class PropertyVisitorInfo {
  @Field(() => User)
  user: User;

  @Field(() => Property)
  property: Property;

  @Field(() => GraphQLISODateTime)
  viewedAt: Date;
}

@ObjectType()
export class PaginatedVisitorsResponse {
  @Field(() => [PropertyVisitorInfo])
  visitors: PropertyVisitorInfo[];

  @Field(() => Int)
  totalCount: number;

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;
}

@ObjectType()
export class PropertyStatsResponse {
  @Field(() => Int)
  totalProperties: number;

  @Field(() => Int)
  activeProperties: number;

  @Field(() => Int)
  totalViews: number;

  @Field(() => Int)
  totalLikes: number;

  @Field(() => Float)
  averagePrice: number;
}

@ObjectType()
export class PropertyTypeStats {
  @Field(() => PropertyType)
  type: PropertyType;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  averagePrice: number;
}

@ObjectType()
export class LocationStats {
  @Field(() => String)
  location: string;

  @Field(() => Int)
  count: number;

  @Field(() => Float)
  averagePrice: number;
}

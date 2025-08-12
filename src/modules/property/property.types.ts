import {
  ArgsType,
  Field,
  ObjectType,
  Int,
  Float,
  registerEnumType,
  GraphQLISODateTime,
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
@ArgsType()
export class GetPropertiesArgs {
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
export class Property {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field(() => PropertyStatus)
  status: PropertyStatus;

  @Field(() => PropertyListingType)
  listingType: PropertyListingType;

  @Field(() => Float)
  amount: number;

  @Field(() => RentalPeriod)
  rentalPeriod: RentalPeriod;

  @Field()
  address: string;

  @Field(() => String)
  city: string;

  @Field(() => String)
  state: string;

  @Field(() => String)
  country: string;

  @Field(() => Float, { nullable: true })
  latitude?: number;

  @Field(() => Float, { nullable: true })
  longitude?: number;

  @Field(() => Float, { nullable: true })
  sqft?: number;

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
  visitingTimeStart?: string;

  @Field(() => String, { nullable: true })
  visitingTimeEnd?: string;

  @Field(() => [String])
  amenities: string[];

  @Field(() => Boolean)
  isFurnished: boolean;

  @Field(() => Boolean)
  isForStudents: boolean;

  @Field(() => Boolean)
  featured: boolean;

  @Field(() => Boolean)
  ownershipVerified: boolean;

  @Field(() => [String])
  images: string[];

  @Field(() => [String])
  livingRoomImages: string[];

  @Field(() => [String])
  bedroomImages: string[];

  @Field(() => [String])
  bathroomImages: string[];

  @Field(() => String, { nullable: true })
  video?: string;

  @Field(() => [String])
  propertyOwnershipDocs: string[];

  @Field(() => [String])
  propertyPlanDocs: string[];

  @Field(() => [String])
  propertyDimensionDocs: string[];

  @Field(() => String)
  ownerId: string;

  @Field(() => User)
  owner: User;

  @Field(() => Int)
  viewsCount: number;

  @Field(() => Int)
  likesCount: number;

  @Field(() => Boolean)
  isLiked: boolean;

  @Field(() => Boolean)
  isViewed: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => Float, { nullable: true })
  distance?: number;
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

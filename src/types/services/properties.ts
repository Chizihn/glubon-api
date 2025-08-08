// src/types/services/properties.ts
import {
  DayOfWeek,
  Property,
  PropertyStatus,
  PropertyType,
  RentalPeriod,
  RoomType,
} from "@prisma/client";

export enum PropertySortByEnum {
  CREATED_AT = "CREATED_AT",
  UPDATED_AT = "UPDATED_AT",
  AMOUNT = "AMOUNT",
  BEDROOMS = "BEDROOMS",
  BATHROOMS = "BATHROOMS",
  SQFT = "SQFT",
}

export enum SortOrder {
  ASC = "ASC",
  DESC = "DESC",
}

export interface CreatePropertyInput {
  title: string;
  description?: string | null;
  amount: number;
  rentalPeriod: RentalPeriod;
  address: string;
  city: string;
  state: string;
  sqft?: number | null;
  bedrooms: number;
  bathrooms: number;
  propertyType: PropertyType;
  roomType: RoomType;
  isFurnished: boolean;
  isForStudents: boolean;
  visitingDays: DayOfWeek[];
  visitingTimeStart?: string | null;
  visitingTimeEnd?: string | null;
  amenities: string[];
}

export interface UpdatePropertyInput {
  title?: string | null;
  description?: string | null | undefined;
  amount?: number | null;
  rentalPeriod?: RentalPeriod | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  sqft?: number | null | undefined;
  bedrooms?: number;
  bathrooms?: number | undefined;
  propertyType?: PropertyType | undefined;
  roomType?: RoomType | undefined;
  isFurnished?: boolean | undefined;
  isForStudents?: boolean | undefined;
  visitingDays?: DayOfWeek[] | undefined;
  visitingTimeStart?: string | null | undefined;
  visitingTimeEnd?: string | null | undefined;
  amenities?: string[];
}

export interface PropertyFilters {
  minAmount?: number | undefined;
  maxAmount?: number | undefined;
  bedrooms?: number | undefined;
  bathrooms?: number | undefined;
  propertyType?: PropertyType | undefined;
  roomType?: RoomType | undefined;
  isFurnished?: boolean | undefined;
  isForStudents?: boolean | undefined;
  city?: string | undefined;
  state?: string | undefined;
  amenities?: string[] | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radiusKm?: number | undefined;
  status?: PropertyStatus | undefined;
}

export interface PropertySearchOptions {
  page?: number | undefined;
  limit?: number | undefined;
  sortBy?: PropertySortByEnum | undefined;
  sortOrder?: SortOrder | undefined;
  search?: string | undefined;
}

export interface PropertyWithDetails extends Property {
  likesCount: number;
  viewsCount: number;
  isLiked?: boolean;
  isViewed?: boolean;
  distance?: number;
}

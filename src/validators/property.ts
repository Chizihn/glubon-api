// src/validators/property.ts
import {
  DayOfWeek,
  PropertyStatus,
  PropertyType,
  PropertyListingType,
  RentalPeriod,
  RoomType,
} from "@prisma/client";
import { z } from "zod";
import { NigerianState } from "../types/enums";

export const createPropertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  rentalPeriod: z.nativeEnum(RentalPeriod),
  address: z.string().min(10, "Address must be at least 10 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.nativeEnum(NigerianState),
  sqft: z.number().positive().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more").optional(),
  bathrooms: z.number().int().min(1, "Must have at least 1 bathroom"),
  propertyType: z.nativeEnum(PropertyType),
  roomType: z.nativeEnum(RoomType),
  isFurnished: z.boolean().default(false),
  isForStudents: z.boolean().default(false),
  visitingDays: z
    .array(z.nativeEnum(DayOfWeek))
    .min(1, "Must have at least one visiting day"),
  visitingTimeStart: z.string().optional(),
  visitingTimeEnd: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  listingType: z.nativeEnum(PropertyListingType).default("RENT"),
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyFiltersSchema = z.object({
  // Search query
  search: z.string().optional(),
  
  // Basic filters
  status: z.nativeEnum(PropertyStatus).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  listingType: z.nativeEnum(PropertyListingType).optional(),
  roomType: z.nativeEnum(RoomType).optional(),
  rentalPeriod: z.nativeEnum(RentalPeriod).optional(),
  
  // Price range
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  
  // Property details
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  isFurnished: z.boolean().optional(),
  isForStudents: z.boolean().optional(),
  
  // Location
  city: z.string().optional(),
  state: z.nativeEnum(NigerianState).optional(),
  
  // Geo-location
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().min(0).optional(),
  
  // Arrays
  amenities: z.array(z.string()).optional(),
  visitingDays: z.array(z.nativeEnum(DayOfWeek)).optional(),
  
  // Date filters
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  updatedAfter: z.date().optional(),
  
  // Make the schema more permissive by allowing unknown keys
  // This ensures backward compatibility with any existing queries
}).passthrough();

// Make the search schema more permissive to match the resolver's expectations
export const propertySearchSchema = z.object({
  page: z.number().int().min(1).default(1).optional(),
  limit: z.number().int().min(1).max(100).default(10).optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.string().optional(),
  filters: z.any().optional(), // Allow any filters to pass through
}).passthrough(); // Allow additional properties

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
export type PropertySearchOptions = z.infer<typeof propertySearchSchema>;

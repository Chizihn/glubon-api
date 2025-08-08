// src/validators/property.ts
import {
  DayOfWeek,
  PropertyStatus,
  PropertyType,
  RentalPeriod,
  RoomType,
} from "@prisma/client";
import { z } from "zod";

export const createPropertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  amount: z.number().positive("Amount must be positive"),
  rentalPeriod: z.nativeEnum(RentalPeriod),
  address: z.string().min(10, "Address must be at least 10 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().min(2, "State must be at least 2 characters"),
  sqft: z.number().positive().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms must be 0 or more"),
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
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertyFiltersSchema = z.object({
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(1).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  roomType: z.nativeEnum(RoomType).optional(),
  isFurnished: z.boolean().optional(),
  isForStudents: z.boolean().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().positive().optional(),
  status: z.nativeEnum(PropertyStatus).optional(),
});

export const propertySearchSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "amount", "bedrooms", "bathrooms"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
export type PropertySearchOptions = z.infer<typeof propertySearchSchema>;

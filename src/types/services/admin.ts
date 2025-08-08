import { PropertyStatus, RoleEnum, UserStatus } from "@prisma/client";

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalProperties: number;
  activeProperties: number;
  pendingVerifications: number;
  totalRevenue: number;
  monthlyGrowth: { users: number; properties: number };
}

export interface AdminUserFilters {
  role?: RoleEnum;
  status?: UserStatus;
  isVerified?: boolean;
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  search?: string;
}

export interface AdminPropertyFilters {
  status?: PropertyStatus;
  ownerId?: string;
  city?: string;
  state?: string;
  minAmount?: number;
  maxAmount?: number;
  ownershipVerified?: boolean;
  featured?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface UpdateUserStatusInput {
  userId: string;
  status: UserStatus;
  reason?: string;
}

export interface UpdatePropertyStatusInput {
  propertyId: string;
  status: PropertyStatus;
  reason?: string;
}

export interface ReviewVerificationInput {
  verificationId: string;
  approved: boolean;
  reason?: string;
}

export interface AnalyticsDateRange {
  startDate?: Date;
  endDate?: Date;
  period?: "day" | "week" | "month" | "year";
}

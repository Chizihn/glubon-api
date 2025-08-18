import {
  UserStatus,
  RoleEnum,
  PermissionEnum,
  ProviderEnum,
  PropertyStatus,
  User,
  Property,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// Base filters and inputs
export interface AdminUserFilters {
  role?: RoleEnum;
  status?: UserStatus;
  isVerified?: boolean;
  isActive?: boolean;
  provider?: ProviderEnum;
  city?: string;
  state?: string;
  country?: string;
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: "name" | "email" | "createdAt" | "lastLogin" | "status";
  sortOrder?: "asc" | "desc";
}

  export interface AdminListFilters {
    permissions?: PermissionEnum[];
    isActive?: boolean;
    status?: UserStatus;
    search?: string;
    createdAfter?: Date;
    createdBefore?: Date;
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
  sortBy?: "title" | "amount" | "createdAt" | "status" | "views";
  sortOrder?: "asc" | "desc";
}

// Admin user management
export interface CreateAdminUserInput {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  password: string;
  permissions: PermissionEnum[];
}

export interface UpdateAdminUserInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  password?: string;
  permissions?: PermissionEnum[];
  isActive?: boolean;
  status?: UserStatus;
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

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    verified: number;
    suspended: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  properties: {
    total: number;
    active: number;
    featured: number;
    pending: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  verifications: {
    pendingIdentity: number;
    pendingOwnership: number;
    approvedToday: number;
    rejectedToday: number;
  };
  activity: {
    totalConversations: number;
    activeConversationsToday: number;
    totalMessages: number;
    messagesToday: number;
    totalPropertyViews: number;
    propertyViewsToday: number;
    totalPropertyLikes: number;
    propertyLikesToday: number;
  };
  admin: {
    totalAdmins: number;
    activeAdmins: number;
    actionsToday: number;
  };
  growth: {
    users: {
      current: number;
      lastMonth: number;
      percentChange: number;
    };
    properties: {
      current: number;
      lastMonth: number;
      percentChange: number;
    };
  };
  totalRevenue: number;
}

export interface UserGrowthData {
  date: string;
  renters: number;
  listers: number;
  total: number;
}

export interface PropertyGrowthData {
  date: string;
  active: number;
  pending: number;
  total: number;
}

export interface ActivityData {
  date: string;
  views: number;
  likes: number;
  messages: number;
  conversations: number;
}

export interface RevenueData {
  date: Date;
  revenue: Decimal;
  transactions: number;
  subscriptions: number;
  commissions: Decimal;
}

export interface GeographicData {
  state: string;
  users: number;
  properties: number;
}

export interface PerformanceMetrics {
  conversionRate: number;
  likeRate: number;
  userRetentionRate: number;
  avgVerificationTime: number;
  avgPropertyApprovalTime: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  topPerformingProperties: Array<{
    id: string;
    title: string;
    views: number;
    likes: number;
    conversations: number;
  }>;
}

// Response types for GraphQL
export interface UserStats {
  properties: number;
  propertyLikes: number;
  conversations: number;
  propertyViews: number;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profilePic?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  role: RoleEnum;
  permissions?: PermissionEnum[];
  provider: ProviderEnum;
  isVerified: boolean;
  isActive: boolean;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  stats: UserStats;
  properties?: any[];
  identityVerifications?: any[];
  propertyLikes?: any[];
  adminActionLogs?: any[];
}

export interface PropertyStats {
  likes: number;
  views: number;
  conversations: number;
}

export interface AdminPropertyResponse {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude?: number;
  longitude?: number;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  furnished: boolean;
  petFriendly: boolean;
  smokingAllowed: boolean;
  status: PropertyStatus;
  featured: boolean;
  ownershipVerified: boolean;
  images: string[];
  amenities: string[];
  rules: string[];
  availableFrom: Date;
  availableTo?: Date;
  createdAt: Date;
  updatedAt: Date;
  owner: User;
  stats: PropertyStats;
}

export interface VerificationResponse {
  id: string;
  documentType: string;
  documentNumber: string;
  frontImageUrl: string;
  backImageUrl?: string;
  selfieUrl?: string;
  status: string;
  rejectionReason?: string;
  createdAt: Date;
  reviewedAt?: Date;
  user: User;
}

export interface OwnershipVerificationResponse {
  id: string;
  documentType: string;
  documentUrl: string;
  status: string;
  rejectionReason?: string;
  createdAt: Date;
  reviewedAt?: Date;
  property: Property;
}

export interface AdminLogResponse {
  id: string;
  action: string;
  data: string; // JSON stringified
  createdAt: Date;
  admin: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Pagination types
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
}

export interface PaginatedUsersResponse
  extends PaginatedResponse<AdminUserResponse> {}
export interface PaginatedPropertiesResponse
  extends PaginatedResponse<AdminPropertyResponse> {}
export interface PaginatedVerificationsResponse
  extends PaginatedResponse<VerificationResponse> {}
export interface PaginatedOwnershipVerificationsResponse
  extends PaginatedResponse<OwnershipVerificationResponse> {}
export interface PaginatedLogsResponse
  extends PaginatedResponse<AdminLogResponse> {}

// Analytics response types
export interface DashboardAnalyticsResponse {
  overview: DashboardStats;
  charts: {
    userGrowth: UserGrowthData[];
    propertyGrowth: PropertyGrowthData[];
    activity: ActivityData[];
    geographic: GeographicData[];
  };
  performance: PerformanceMetrics;
}

// Analytics and Statistics
export interface AnalyticsDateRange {
  startDate?: Date;
  endDate?: Date;
}

// Export types
export interface ExportRequest {
  type:
    | "users"
    | "properties"
    | "activity"
    | "revenue"
    | "verifications"
    | "logs";
  format: "csv" | "json" | "xlsx";
  dateRange?: AnalyticsDateRange;
  filters?: Record<string, any>;
}

export interface ExportResponse {
  downloadUrl: string;
  filename: string;
  size: number;
  expiresAt: Date;
}

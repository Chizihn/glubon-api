//src/modules/admin/admin.types.ts
import {
  DocumentType,
  PropertyStatus,
  RoleEnum,
  VerificationStatus,
} from "@prisma/client";
import {
  ObjectType,
  Field,
  Int,
  ID,
  registerEnumType,
  Float,
  GraphQLISODateTime,
} from "type-graphql";
import { PaginatedResponse } from "../../types/responses";
import GraphQLJSON from "graphql-type-json";
import { User } from "../user/user.types";
import { Property } from "../property/property.types";

registerEnumType(DocumentType, {
  name: "DocumentType",
  description: "Types of documents accepted for user verification",
});

registerEnumType(PropertyStatus, {
  name: "PropertyStatus",
  description: "Status of a property listing (e.g., active, pending, inactive)",
});

registerEnumType(RoleEnum, {
  name: "RoleEnum",
  description:
    "User roles within the application (e.g., user, admin, super admin)",
});

registerEnumType(VerificationStatus, {
  name: "VerificationStatus",
  description:
    "Status of a verification request (e.g., pending, approved, rejected)",
});

@ObjectType()
export class AdminUserStatsResponse {
  @Field(() => Int)
  properties: number;

  @Field(() => Int)
  propertyLikes: number;

  @Field(() => Int)
  conversations: number;

  @Field(() => Int)
  propertyViews: number;
}

@ObjectType()
export class AdminUserResponse extends User {
  @Field(() => AdminUserStatsResponse)
  stats: AdminUserStatsResponse;

  @Field(() => [Property], { nullable: true })
  properties?: Property[];

  @Field(() => [VerificationResponse], { nullable: true })
  identityVerifications?: VerificationResponse[];

  @Field(() => [PropertyLikeResponse], { nullable: true })
  propertyLikes?: PropertyLikeResponse[];
}

@ObjectType()
class PropertyOwnerResponse {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => Boolean)
  isVerified: boolean;
}

@ObjectType()
class AdminPropertyStatsResponse {
  @Field(() => Int)
  likes: number;

  @Field(() => Int)
  views: number;

  @Field(() => Int)
  conversations: number;
}

@ObjectType()
export class AdminPropertyResponse {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => PropertyStatus)
  status: PropertyStatus;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  address: string;

  @Field(() => String)
  city: string;

  @Field(() => String)
  state: string;

  @Field(() => Int)
  bedrooms: number;

  @Field(() => Int)
  bathrooms: number;

  @Field(() => Boolean)
  featured: boolean;

  @Field(() => Boolean)
  ownershipVerified: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => PropertyOwnerResponse)
  owner: PropertyOwnerResponse;

  @Field(() => AdminPropertyStatsResponse)
  stats: AdminPropertyStatsResponse;
}

@ObjectType()
export class VerificationUserResponse {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => RoleEnum)
  role: RoleEnum;
}

@ObjectType()
export class VerificationResponse {
  @Field(() => ID)
  id: string;

  @Field(() => DocumentType)
  documentType: DocumentType;

  @Field(() => String)
  documentNumber: string;

  @Field(() => [String])
  documentImages: string[];

  @Field(() => VerificationStatus)
  status: VerificationStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  reviewedAt?: Date;

  @Field(() => String, { nullable: true })
  reviewedBy?: string;

  @Field(() => String, { nullable: true })
  rejectionReason?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => VerificationUserResponse)
  user: VerificationUserResponse;
}

@ObjectType()
export class OwnershipVerificationPropertyResponse {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  address: string;

  @Field(() => String)
  city: string;

  @Field(() => String)
  state: string;

  @Field(() => Float)
  amount: number;

  @Field(() => PropertyOwnerResponse)
  owner: PropertyOwnerResponse;
}

@ObjectType()
export class OwnershipVerificationResponse {
  @Field(() => ID)
  id: string;

  @Field(() => [String])
  documentImages: string[];

  @Field(() => VerificationStatus)
  status: VerificationStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  reviewedAt?: Date;

  @Field(() => String, { nullable: true })
  reviewedBy?: string;

  @Field(() => String, { nullable: true })
  rejectionReason?: string;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => OwnershipVerificationPropertyResponse)
  property: OwnershipVerificationPropertyResponse;
}

@ObjectType()
export class AdminLogResponse {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  action: string;

  @Field(() => GraphQLJSON)
  data: any;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => User)
  admin: User;
}

@ObjectType()
export class ChartDataResponse {
  @Field(() => String)
  date: string;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class AnalyticsChartsResponse {
  @Field(() => [ChartDataResponse])
  userGrowth: ChartDataResponse[];

  @Field(() => [ChartDataResponse])
  propertyGrowth: ChartDataResponse[];
}

@ObjectType()
export class ToggleFeaturedResponse {
  @Field(() => Boolean)
  featured: boolean;
}

@ObjectType()
export class PaginatedUsersResponse extends PaginatedResponse<User> {
  @Field(() => [User])
  declare items: User[];
}

@ObjectType()
export class AdminPaginatedPropertiesResponse extends PaginatedResponse<AdminPropertyResponse> {
  @Field(() => [AdminPropertyResponse], { nullable: true })
  declare items: AdminPropertyResponse[];
}

@ObjectType()
export class PaginatedVerificationsResponse extends PaginatedResponse<VerificationResponse> {
  @Field(() => [VerificationResponse])
  declare items: VerificationResponse[];
}

@ObjectType()
export class PaginatedOwnershipVerificationsResponse extends PaginatedResponse<OwnershipVerificationResponse> {
  @Field(() => [OwnershipVerificationResponse])
  declare items: OwnershipVerificationResponse[];
}

@ObjectType()
export class PaginatedLogsResponse extends PaginatedResponse<AdminLogResponse> {
  @Field(() => [AdminLogResponse])
  declare items: AdminLogResponse[];
}

@ObjectType()
export class PropertyLikeResponse {
  @Field(() => ID)
  id: string;

  @Field(() => Property)
  property: Property;
}

@ObjectType()
export class ExportResponse {
  @Field(() => String)
  downloadUrl: string;

  @Field(() => String)
  filename: string;

  @Field(() => Int)
  size: number;

  @Field(() => GraphQLISODateTime)
  expiresAt: Date;
}

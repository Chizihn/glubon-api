import {
  Field,
  GraphQLISODateTime,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from "type-graphql";
import {
  PermissionEnum,
  PropertyStatus,
  PropertyType,
  RoleEnum,
  UserStatus,
} from "@prisma/client";
import { GraphQLJSONObject } from "graphql-type-json";

registerEnumType(PermissionEnum, {
  name: "PermissionEnum",
  description: "Permissions for admin users",
});

@InputType()
export class CreateAdminUserInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  phoneNumber?: string | null;

  @Field(() => String)
  password: string;

  @Field(() => [PermissionEnum])
  permissions: PermissionEnum[];
}

@InputType()
export class UpdateAdminUserInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  phoneNumber?: string | null;

  @Field(() => String)
  password: string;

  @Field(() => [PermissionEnum])
  permissions: PermissionEnum[];

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => UserStatus)
  status: UserStatus;
}

@InputType()
export class UpdateUserStatusInput {
  @Field(() => String)
  userId: string;

  @Field(() => UserStatus)
  status: UserStatus;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class AdminUserFilters {
  @Field(() => RoleEnum, { nullable: true })
  role?: RoleEnum;

  @Field(() => UserStatus, { nullable: true })
  status?: UserStatus;

  @Field(() => Boolean, { nullable: true })
  isVerified?: boolean;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAfter?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdBefore?: Date;

  @Field(() => String, { nullable: true })
  search?: string;
}

@InputType()
export class AdminListFilters {

  @Field(() => [PermissionEnum], { nullable: true })
  permissions?: PermissionEnum[];

  @Field(() => Boolean, { nullable: true })
  isVerified?: boolean;

  @Field(() => Boolean, { nullable: true })
  isActive?: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAfter?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdBefore?: Date;

  @Field(() => String, { nullable: true })
  search?: string;
}

@InputType()
export class AdminPropertyFilters {
  @Field(() => PropertyStatus, { nullable: true })
  status?: PropertyStatus;
  
  @Field(() => String, { nullable: true })
  ownerId?: string;
  
  @Field(() => String, { nullable: true })
  city?: string;
  
  @Field(() => String, { nullable: true })
  state?: string;
  
  @Field(() => Int, { nullable: true })
  minAmount?: number;
  
  @Field(() => Int, { nullable: true })
  maxAmount?: number;
  
  // Fix: Allow null values explicitly
  @Field(() => Boolean, { nullable: true })
  ownershipVerified?: boolean | null;
  
  @Field(() => Boolean, { nullable: true })
  featured?: boolean | null;
  
  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAfter?: Date;
  
  @Field(() => GraphQLISODateTime, { nullable: true })
  createdBefore?: Date;
  
  @Field(() => PropertyType, { nullable: true })
  propertyType?: PropertyType;
  
  // Add the missing fields from your repository interface
  @Field(() => String, { nullable: true })
  sortBy?: "title" | "amount" | "createdAt" | "status" | "views";
  
  @Field(() => String, { nullable: true })
  sortOrder?: "asc" | "desc";
}

@InputType()
export class UpdatePropertyStatusInput {
  @Field(() => String)
  propertyId: string;

  @Field(() => PropertyStatus)
  status: PropertyStatus;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class ReviewVerificationInput {
  @Field(() => String)
  verificationId: string;

  @Field(() => Boolean)
  approved: boolean;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class AnalyticsDateRangeInput {
  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;

  @Field(() => String, { nullable: true })
  period?: "day" | "week" | "month" | "year";
}

@InputType()
export class ExportRequestInput {
  @Field(() => String)
  type:
    | "users"
    | "properties"
    | "activity"
    | "revenue"
    | "verifications"
    | "logs";

  @Field(() => String)
  format: "csv" | "json" | "xlsx";

  @Field(() => AnalyticsDateRangeInput, { nullable: true })
  dateRange?: AnalyticsDateRangeInput;

  @Field(() => GraphQLJSONObject, { nullable: true })
  filters?: Record<string, any>;
}

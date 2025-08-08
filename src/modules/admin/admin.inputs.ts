import { Field, InputType, Int } from "type-graphql";
import { PropertyStatus, RoleEnum, UserStatus } from "@prisma/client";

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

  @Field(() => Date, { nullable: true })
  createdAfter?: Date;

  @Field(() => Date, { nullable: true })
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

  @Field(() => Boolean, { nullable: true })
  ownershipVerified?: boolean;

  @Field(() => Boolean, { nullable: true })
  featured?: boolean;

  @Field(() => Date, { nullable: true })
  createdAfter?: Date;

  @Field(() => Date, { nullable: true })
  createdBefore?: Date;
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
  @Field(() => Date, { nullable: true })
  startDate?: Date;

  @Field(() => Date, { nullable: true })
  endDate?: Date;

  @Field(() => String, { nullable: true })
  period?: "day" | "week" | "month" | "year";
}

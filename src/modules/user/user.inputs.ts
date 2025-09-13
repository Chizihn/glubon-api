import { DocumentType, RoleEnum, VerificationStatus } from "@prisma/client";
import {
  Field,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
} from "type-graphql";
import { PaginatedResponse, PaginationInfo } from "../../types";

@InputType()
export class UpdateProfileInput {
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => String, { nullable: true })
  city?: string;

  @Field(() => String, { nullable: true })
  state?: string;

  @Field(() => String, { nullable: true })
  profilePic?: string;
}

@InputType()
export class ChangePasswordInput {
  @Field(() => String)
  currentPassword: string;

  @Field(() => String)
  newPassword: string;
}

@InputType()
export class SubmitIdentityVerificationInput {
  @Field(() => DocumentType)
  documentType: DocumentType; // You might want to create an enum for this

  @Field(() => [String])
  documentNumber: string;

  @Field(() => [String])
  documentImages: string[];
}

@InputType()
export class AccountResolveInput {
  @Field(() => String)
  accountNumber!: string;

  @Field(() => String)
  bankCode!: string;
}

// ===== RESPONSE TYPES =====
@ObjectType()
export class UserProfileResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string | null;

  @Field(() => String, { nullable: true })
  profilePic?: string | null;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  state?: string | null;

  @Field(() => String, { nullable: true })
  country?: string | null;

  @Field(() => RoleEnum)
  role: RoleEnum;

  @Field(() => Boolean)
  isVerified: boolean;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => String)
  status: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLogin?: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

@ObjectType()
export class IdentityVerificationStatusResponse {
  @Field(() => ID, { nullable: true })
  id?: string;

  @Field(() => String, { nullable: true })
  documentType?: string;

  @Field(() => VerificationStatus, { nullable: true })
  status?: VerificationStatus;

  @Field(() => GraphQLISODateTime, { nullable: true })
  reviewedAt?: Date;

  @Field(() => String, { nullable: true })
  rejectionReason?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class UserSearchItem {
  @Field(() => ID)
  id: string;

  @Field(() => String,{ nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String)
  email: string;

  @Field(() => String,{ nullable: true })
  profilePic?: string;

  @Field(() => RoleEnum)
  role: RoleEnum;

  @Field(() => Boolean)
  isVerified: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType()
export class UsersSearchResponse extends PaginatedResponse<UserSearchItem> {
  // ...existing code...

  constructor(
    items: UserSearchItem[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    super(items, page, limit, totalItems);
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}


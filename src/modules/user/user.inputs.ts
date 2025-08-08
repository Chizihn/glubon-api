import { DocumentType, RoleEnum } from "@prisma/client";
import { Field, ID, InputType, Int, ObjectType } from "type-graphql";
import { PaginatedResponse, PaginationInfo } from "../../types";

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  phoneNumber?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;

  @Field({ nullable: true })
  profilePic?: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  currentPassword: string;

  @Field()
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

  @Field(() => Date, { nullable: true })
  lastLogin?: Date | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class IdentityVerificationStatusResponse {
  @Field({ nullable: true })
  id?: string;

  @Field({ nullable: true })
  documentType?: string;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  reviewedAt?: Date;

  @Field({ nullable: true })
  rejectionReason?: string;

  @Field({ nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class UserSearchItem {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  profilePic?: string;

  @Field()
  role: string;

  @Field()
  isVerified: boolean;

  @Field()
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

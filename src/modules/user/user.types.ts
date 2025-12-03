import {
  ObjectType,
  Field,
  ID,
  Int,
  registerEnumType,
  GraphQLISODateTime,
} from "type-graphql";
import {
  DocumentType,
  ProviderEnum,
  RoleEnum,
  UserStatus,
} from "@prisma/client";
import { PaginatedResponse } from "../../types";

registerEnumType(RoleEnum, {
  name: "RoleEnum",
  description: "Role of account",
});
registerEnumType(UserStatus, {
  name: "UserStatus",
  description: "Status of use account",
});
registerEnumType(DocumentType, {
  name: "DocumentType",
  description: "Type of document submitted",
});

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  email: string;

  @Field(() => ProviderEnum)
  provider?: ProviderEnum;

  @Field(() => Boolean)
  isActive?: boolean;

  @Field(() => String, { nullable: true })
  phoneNumber?: string | null;

  @Field(() => String, { nullable: true })
  profilePic?: string | null;

  @Field(() => Boolean)
  isVerified: boolean;

  @Field(() => RoleEnum, { deprecationReason: "Use roles instead" })
  role: RoleEnum;

  @Field(() => [RoleEnum])
  roles: RoleEnum[];

  @Field(() => UserStatus)
  status: UserStatus;

  @Field(() => String, { nullable: true })
  address?: string | null;

  @Field(() => String, { nullable: true })
  city?: string | null;

  @Field(() => String, { nullable: true })
  state?: string | null;

  @Field(() => String, { nullable: true })
  country?: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLogin?: Date | null;
}
@ObjectType()
export class UserStatsResponse {
  @Field(() => Int)
  propertiesCount: number;

  @Field(() => Int)
  likedPropertiesCount: number;

  @Field(() => Int)
  viewedPropertiesCount: number;

  @Field(() => Int)
  conversationsCount: number;

  @Field(() => Int, { nullable: true })
  unreadNotificationsCount?: number;
}

@ObjectType()
export class IdentityVerificationStatusResponse {
  @Field(() => String, { nullable: true })
  id?: string;

  @Field(() => DocumentType, { nullable: true })
  documentType?: DocumentType;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  reviewedAt?: Date;

  @Field(() => String, { nullable: true })
  rejectionReason?: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class UsersSearchResponse extends PaginatedResponse<User> {
  // ...existing code...
}

@ObjectType()
export class AccountDetails {
  @Field(() => String)
  accountNumber!: string;

  @Field(() => String)
  accountName!: string;

  @Field(() => String)
  bankCode!: string;
}



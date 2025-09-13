import { ObjectType, Field, Int, GraphQLISODateTime } from "type-graphql";
import { User } from "../user/user.types";
import { PaginationInfo } from "../../types";
import { GraphQLJSONObject } from "graphql-type-json";

@ObjectType()
export class UserSetting {
  @Field(() => String)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  notificationPreferences: Record<string, boolean>;

  @Field(() => String, { nullable: true })
  theme: string;

  @Field(() => String, { nullable: true })
  language: string;

  @Field(() => Boolean)
  receivePromotions: boolean;

  @Field(() => Boolean)
  pushNotifications: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;
}

// Interface for the raw database result
export interface PlatformSettingDB {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  updater?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    status: string;
    role: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

@ObjectType()
export class PlatformSetting {
  @Field(() => String)
  id: string;

  @Field(() => String)
  key: string;

  @Field(() => String)
  value: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => String)
  updatedBy: string;

  @Field(() => User, { nullable: true })
  updater: User | null;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class PaginatedPlatformSettingsResponse {
  @Field(() => [PlatformSetting])
  items: PlatformSetting[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(items: PlatformSetting[], page: number, limit: number, totalItems: number) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}
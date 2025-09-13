import { GraphQLJSONObject } from "graphql-type-json";
import { InputType, Field } from "type-graphql";

@InputType()
export class UserSettingInput {
  @Field(() => GraphQLJSONObject, { nullable: true })
  notificationPreferences?: Record<string, boolean>;

  @Field(() => String, { nullable: true })
  theme?: string;

  @Field(() => String, { nullable: true })
  language?: string;

  @Field(() => Boolean, { nullable: true })
  receivePromotions?: boolean;

  @Field(() => Boolean, { nullable: true })
  pushNotifications?: boolean;
}

@InputType()
export class PlatformSettingInput {
  @Field(() => String)
  key: string;

  @Field(() => String)
  value: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@InputType()
export class PlatformSettingFilter {
  @Field(() => String, { nullable: true })
  key?: string;

  @Field(() => String, { nullable: true })
  search?: string;
}
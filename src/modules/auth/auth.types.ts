import { ProviderEnum, RoleEnum } from "@prisma/client";
import { ObjectType, Field, registerEnumType, GraphQLISODateTime } from "type-graphql";
import { User } from "../user/user.types";

registerEnumType(RoleEnum, { name: "RoleEnum" });
registerEnumType(ProviderEnum, { name: "ProviderEnum" });

@ObjectType()
export class AuthResponse {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  refreshToken: string;

  @Field(() => GraphQLISODateTime)
  expiresAt: Date;

  @Field(() => User)
  user: User;
}

@ObjectType()
export class TokenResponse {
  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  refreshToken: string;

  @Field(() => GraphQLISODateTime)
  expiresAt: Date;
}

@ObjectType()
export class OAuthUrlResponse {
  @Field(() => String)
  authUrl: string;
}

@ObjectType()
export class OAuthTokenResponse {
  @Field(() => String)
  accessToken: string;
}

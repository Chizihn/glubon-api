import { ProviderEnum, RoleEnum } from "@prisma/client";
import { Field, InputType } from "type-graphql";

@InputType()
export class RegisterInput {
  @Field(() => String)
  email: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  password: string;

  @Field(() => String, { nullable: true })
  phoneNumber?: string;

  @Field(() => RoleEnum)
  role: RoleEnum;

  @Field(() => ProviderEnum, { nullable: true })
  provider?: ProviderEnum;
}

@InputType()
export class OAuthRegisterInput {
  @Field(() => String)
  accessToken: string;

  @Field(() => ProviderEnum)
  provider: ProviderEnum;

  @Field(() => RoleEnum)
  role: RoleEnum;
}

@InputType()
export class OAuthLoginInput {
  @Field(() => String)
  accessToken: string;

  @Field(() => ProviderEnum)
  provider: ProviderEnum;

  @Field(() => RoleEnum, { nullable: true })
  role?: RoleEnum;
}

@InputType()
export class GetOAuthUrlInput {
  @Field(() => ProviderEnum)
  provider: ProviderEnum;

  @Field(() => String)
  redirectUri: string;

  @Field(() => RoleEnum, { nullable: true })
  role?: RoleEnum;
}

@InputType()
export class ExchangeOAuthCodeInput {
  @Field(() => ProviderEnum)
  provider: ProviderEnum;

  @Field(() => String)
  code: string;

  @Field(() => String)
  redirectUri: string;
}

@InputType()
export class LinkProviderInput {
  @Field(() => ProviderEnum)
  provider: ProviderEnum;

  @Field(() => String)
  providerId: string;

  @Field(() => String, { nullable: true })
  email?: string;
}

@InputType()
export class SetPasswordInput {
  @Field(() => String)
  password: string;
}

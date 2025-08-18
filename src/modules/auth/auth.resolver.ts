import {
  Resolver,
  Mutation,
  Query,
  UseMiddleware,
  Arg,
  Ctx,
} from "type-graphql";

import {
  AuthResponse,
  OAuthTokenResponse,
  OAuthUrlResponse,
  TokenResponse,
} from "./auth.types";
import {
  ExchangeOAuthCodeInput,
  GetOAuthUrlInput,
  LinkProviderInput,
  OAuthLoginInput,
  OAuthRegisterInput,
  RegisterInput,
  SetPasswordInput,
} from "./auth.inputs";
import { User } from "../user/user.types";
import { AuthService } from "../../services/auth";
import { EmailService } from "../../services/email";
import { prisma, redis } from "../../config";
import { BaseResponse, Context } from "../../types";
import { AuthMiddleware } from "../../middleware";
import { registerSchema } from "../../validators";

// const AuthRateLimiter = wrapExpressMiddleware(authRateLimiterMiddleware);

@Resolver()
export class AuthResolver {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService(prisma, redis);
    this.authService = new AuthService(prisma, redis);
  }

  @Mutation(() => AuthResponse)
  async register(
    @Arg("input") input: RegisterInput,
    @Ctx() ctx: Context
  ): Promise<AuthResponse> {
    const validatedInput = registerSchema.parse(input);
    const result = await this.authService.register({...validatedInput, phoneNumber: validatedInput.phoneNumber || ""});
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => AuthResponse)
  async login(
    @Arg("email") email: string,
    @Arg("password") password: string,
    @Ctx() ctx: Context
  ): Promise<AuthResponse> {
    const result = await this.authService.login({ email, password });
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => TokenResponse)
  async refreshToken(
    @Arg("refreshToken") refreshToken: string,
    @Ctx() ctx: Context
  ): Promise<TokenResponse> {
    const result = await this.authService.refreshToken({ refreshToken });
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async logout(@Ctx() ctx: Context): Promise<BaseResponse> {
    const result = await this.authService.logout(ctx.user!.id as string);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async verifyEmail(
    @Arg("token") token: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.verifyEmail({ token });
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.forgotPassword({ email });
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async resetPassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.resetPassword({ token, newPassword });
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async resendVerificationEmail(
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.resendVerificationEmail(ctx.user!.email as string);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async resendPasswordReset(
    @Arg("email") email: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.resendPasswordReset(email);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Query(() => OAuthUrlResponse)
  async getOAuthAuthUrl(
    @Arg("input") input: GetOAuthUrlInput
  ): Promise<OAuthUrlResponse> {
    const result = await this.authService.getOAuthAuthUrl(
      input.provider,
      input.redirectUri,
      input.state
    );
    if (!result.success) throw new Error(result.message);
    return { authUrl: result.data!.authUrl };
  }

  @Mutation(() => OAuthTokenResponse)
  async exchangeOAuthCode(
    @Arg("input") input: ExchangeOAuthCodeInput
  ): Promise<OAuthTokenResponse> {
    const result = await this.authService.exchangeOAuthCode(
      input.provider,
      input.code,
      input.redirectUri
    );
    if (!result.success) throw new Error(result.message);
    return { accessToken: result.data!.accessToken };
  }

  @Mutation(() => AuthResponse)
  async registerWithOAuth(
    @Arg("input") input: OAuthRegisterInput,
    @Ctx() ctx: Context
  ): Promise<AuthResponse> {
    const result = await this.authService.registerWithProvider(input);
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => AuthResponse)
  async loginWithOAuth(
    @Arg("input") input: OAuthLoginInput,
    @Ctx() ctx: Context
  ): Promise<AuthResponse> {
    const result = await this.authService.loginWithProvider(input);
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async linkProvider(
    @Arg("input") input: LinkProviderInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.linkProvider(
      ctx.user!.id as string,
      input
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async unlinkProvider(@Ctx() ctx: Context): Promise<BaseResponse> {
    const result = await this.authService.unlinkProvider(
      ctx.user!.id as string
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async setPasswordForOAuthUser(
    @Arg("input") input: SetPasswordInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.authService.setPasswordForOAuthUser(
      ctx.user!.id as string,
      input.password
    );
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Query(() => User)
  @UseMiddleware(AuthMiddleware)
  async me(@Ctx() ctx: Context): Promise<User> {
    return ctx.user as User;
  }
}

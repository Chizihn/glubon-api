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
import { getContainer } from "../../services";
import { AuthService } from "../../services/auth";
import { EmailService } from "../../services/email";
import { BaseResponse, Context } from "../../types";
import { AuthMiddleware } from "../../middleware";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "../../validators";
import { config } from "../../config";

// const AuthRateLimiter = wrapExpressMiddleware(authRateLimiterMiddleware);

@Resolver()
export class AuthResolver {
  private authService: AuthService;
  private emailService: EmailService;

  constructor() {
    const container = getContainer();
    
    this.authService = container.resolve('authService');
    this.emailService = container.resolve('emailService');
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
    const validatedInput = loginSchema.parse({ email, password });
    const result = await this.authService.login(validatedInput);
    if (!result.success) throw new Error(result.message);
    return result.data!;
  }

  @Mutation(() => TokenResponse)
  async refreshToken(
    @Arg("refreshToken") refreshToken: string,
    @Ctx() ctx: Context
  ): Promise<TokenResponse> {
    const validatedInput = refreshTokenSchema.parse({ refreshToken });
    const result = await this.authService.refreshToken(validatedInput);
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
    const validatedInput = verifyEmailSchema.parse({ token });
    const result = await this.authService.verifyEmail(validatedInput);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const validatedInput = forgotPasswordSchema.parse({ email });
    const result = await this.authService.forgotPassword(validatedInput);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  async resetPassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const validatedInput = resetPasswordSchema.parse({ token, newPassword });
    const result = await this.authService.resetPassword(validatedInput);
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
    const validatedInput = forgotPasswordSchema.parse({ email });
    const result = await this.authService.resendPasswordReset(validatedInput.email);
    if (!result.success) throw new Error(result.message);
    return new BaseResponse(true, result.message);
  }

@Query(() => OAuthUrlResponse)
async getOAuthAuthUrl(
  @Arg("input") input: GetOAuthUrlInput
): Promise<OAuthUrlResponse> {
  const { provider, redirectUri, role } = input;

  // Get base URL from config and escape special regex characters
  const baseUrl = config.API_BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Validate redirectUri (whitelist with regex patterns)
  const allowedPatterns = [
    // Match the configured API URL with /api/oauth/[provider]/callback
    new RegExp(`^${baseUrl}\/api\/oauth\/[a-z]+\/callback(\\?.*)?$`, 'i'),
    // Match the root callback that will be redirected to provider-specific callback
    new RegExp(`^${baseUrl}\/api\/oauth\/callback(\\?.*)?$`, 'i'),
    // Keep all existing patterns for backward compatibility
    // Match any ngrok URL with /api/oauth/[provider]/callback
    /^https?:\/\/[a-z0-9-]+\.ngrok(-free)?\.app\/api\/oauth\/[a-z]+\/callback(\?.*)?$/i,
    // Match localhost with any port and /api/oauth/[provider]/callback
    /^https?:\/\/localhost(:\d+)?\/api\/oauth\/[a-z]+\/callback(\?.*)?$/i,
    // Match the deep link scheme
    /^glubon:\/\/oauth(\?.*)?$/,
    // Match the specific ngrok URL with provider
    /^https?:\/\/subtle-cuddly-colt\.ngrok-free\.app\/api\/oauth\/[a-z]+\/callback(\?.*)?$/i,
    // Match the root callback that will be redirected to provider-specific callback
    /^https?:\/\/subtle-cuddly-colt\.ngrok-free\.app\/api\/oauth\/callback(\?.*)?$/i
  ];

  const isValid = allowedPatterns.some(pattern => pattern.test(redirectUri));
  
  if (!isValid) {
    console.warn('Invalid redirect URI:', redirectUri);
    console.warn('Allowed patterns:', allowedPatterns.map(p => p.toString()));
    throw new Error("Invalid redirect URI. Please use a valid callback URL.");
  }

  const result = await this.authService.getOAuthAuthUrl(
    provider,
    redirectUri,
    role
  );

  if (!result.success || !result.data) {
    throw new Error(result.message);
  }

  return {
    authUrl: result.data.authUrl,
    state: result.data.state, // ← return state too
  };
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

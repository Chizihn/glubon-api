import { PrismaClient, ProviderEnum, RoleEnum, User } from "@prisma/client";
import type { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import { BaseService } from "./base";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "../types";
import { logger } from "../utils";
import { AuthTokens, OAuthTokenData, OAuthUserData } from "../types/services/auth";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { jwtConfig } from "../config";

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function sha256(buffer: Buffer): Buffer {
  return crypto.createHash("sha256").update(buffer).digest();
}

export class OAuthService extends BaseService {

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

 // Key changes in startOAuthFlow method:

async startOAuthFlow(
  provider: ProviderEnum,
  code: string,
  redirectUri: string,
  state: string
): Promise<ServiceResponse<OAuthUserData & { accessToken: string; refreshToken: string }>> {
  let role: string | undefined;

  try {
    console.log('startOAuthFlow called with:', { provider, state, redirectUri });

    // === 1. Retrieve stored state data from Redis ===
    const redisKey = `oauth_state:${state}`;
    const storedStateValue = await this.redis.get(redisKey);
    console.log('Retrieved state from Redis:', { key: redisKey, found: !!storedStateValue });

    if (!storedStateValue) {
      console.error('State not found or expired in Redis for key:', redisKey);
      return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
        "Invalid or expired state parameter. Please try signing in again.",
        null,
        [StatusCodes.BAD_REQUEST]
      );
    }

    // === 2. Parse and validate the stored state data ===
    let stateData;
    try {
      stateData = JSON.parse(storedStateValue);
      console.log('Parsed state data:', stateData);
      
      // Verify the state in the stored data matches the one we received
      if (stateData.state !== state) {
        console.error('State mismatch:', { received: state, stored: stateData.state });
        await this.redis.del(redisKey); // Clean up invalid state
        return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
          "Invalid state parameter",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }
      
      // Extract role and provider from the stored state
      role = stateData.role;
      const stateProvider = stateData.provider;
      
      // Verify the provider matches
      if (stateProvider && stateProvider !== provider) {
        console.error('Provider mismatch:', { expected: provider, actual: stateProvider });
        await this.redis.del(redisKey);
        return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
          "Invalid OAuth provider. Please try again with the correct provider.",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }
      
      // Verify the state hasn't expired (10 minutes)
      const stateAge = Date.now() - (stateData.timestamp || 0);
      const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes
      
      if (stateAge > STATE_EXPIRY) {
        console.error('State has expired:', { stateAge, state });
        await this.redis.del(redisKey);
        return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
          "Your session has expired. Please try signing in again.",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }
    } catch (e) {
      console.error('Error parsing state data:', e);
      await this.redis.del(redisKey);
      return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
        "Invalid state data format",
        null,
        [StatusCodes.BAD_REQUEST]
      );
    }

    // === 3. CRITICAL FIX: Delete state ONLY after successful validation ===
    // DON'T delete it yet - wait until token exchange succeeds
    console.log('State validated successfully, proceeding with token exchange');

    // === 4. Normalize redirect URI ===
    let finalRedirectUri = redirectUri;

    // Force HTTPS for ngrok
    if (finalRedirectUri.includes('ngrok-free.app') && finalRedirectUri.startsWith('http:')) {
      finalRedirectUri = finalRedirectUri.replace('http:', 'https:');
    }

    // Make callback provider-specific if generic
    if (finalRedirectUri.endsWith('/api/oauth/callback')) {
      finalRedirectUri = finalRedirectUri.replace('/callback', `/${provider.toLowerCase()}/callback`);
    }

    console.log('Final redirect URI:', finalRedirectUri);

    // === 5. Exchange code for token (with PKCE if applicable) ===
    const tokenResult = await this.exchangeCodeForToken(
      provider,
      code,
      finalRedirectUri,
      state
    );

    if (!tokenResult.success || !tokenResult.data) {
      // IMPORTANT: Don't delete state here - user might retry
      console.error('Token exchange failed:', tokenResult.message);
      return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
        tokenResult.message || "Failed to exchange authorization code",
        null,
        [StatusCodes.UNAUTHORIZED]
      );
    }

    const { accessToken } = tokenResult.data;

    // === 6. NOW delete state after successful token exchange ===
    await this.redis.del(redisKey);
    await this.redis.del(`oauth_verifier:${state}`);
    console.log('Deleted state and verifier after successful token exchange');

    // === 7. Verify provider token and get user data ===
    const userResult = await this.verifyProviderToken(provider, accessToken);
    if (!userResult.success || !userResult.data) {
      return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
        userResult.message || "Invalid provider token",
        null,
        [StatusCodes.UNAUTHORIZED]
      );
    }

    const userData = userResult.data;

    // === 8. Find or create user in database ===
    let user = await this.prisma.user.findUnique({
      where: { email: userData.email },
      include: { providerAccounts: true },
    });

    const wasNewAccount = !user;

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profilePic: userData.profilePic || "",
          isVerified: userData.isEmailVerified,
          provider,
          role: role as RoleEnum,
          providerAccounts: {
            create: {
              provider,
              providerId: userData.id,
              accessToken,
            },
          },
        },
        include: { providerAccounts: true },
      });
    } else {
      // Link or update existing account
      const hasProvider = user.providerAccounts.some(
        (pa) => pa.provider === provider && pa.providerId === userData.id
      );

      if (!hasProvider) {
        await this.prisma.providerAccount.create({
          data: {
            userId: user.id,
            provider,
            providerId: userData.id,
            accessToken,
          },
        });

        // Upgrade from EMAIL provider
        if (user.provider === ProviderEnum.EMAIL) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              provider,
              isVerified: true,
              profilePic: user.profilePic || userData.profilePic || "",
              firstName: user.firstName || userData.firstName,
              lastName: user.lastName || userData.lastName,
              role: role as RoleEnum || user.role,
            },
          });
        }
      } else {
        // Update existing access token
        await this.prisma.providerAccount.updateMany({
          where: {
            userId: user.id,
            provider,
            providerId: userData.id,
          },
          data: { accessToken },
        });
      }
    }

    // === 9. Generate JWT tokens ===
    const tokens = await this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    });

    // === 10. Determine success message ===
    const wasAccountLinked =
      user.providerAccounts.length > 1 ||
      (user.provider === ProviderEnum.EMAIL && user.providerAccounts.length === 1);

    const message = wasAccountLinked
      ? `Successfully linked your ${provider} account`
      : wasNewAccount
      ? 'Welcome! Your account has been created successfully'
      : 'Login successful';

    // === 11. Return success ===
    return this.success(
      {
        ...userData,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isNewAccount: wasNewAccount,
        message,
      },
      message
    );
  } catch (error: any) {
    logger.error(`${provider} OAuth flow failed:`, error);

    // === Safe cleanup on error ===
    try {
      await this.redis.del(`oauth_state:${state}`);
      await this.redis.del(`oauth_verifier:${state}`);
    } catch (cleanupError) {
      console.warn('Failed to clean up Redis state on error:', cleanupError);
    }

    return this.failure<OAuthUserData & { accessToken: string; refreshToken: string }>(
      `Failed to complete ${provider} OAuth flow`,
      null,
      [StatusCodes.INTERNAL_SERVER_ERROR]
    );
  }
}

// In OAuthService
// async generateAuthUrl(
//   provider: ProviderEnum,
//   redirectUri: string,
//   role: RoleEnum
// ): Promise<ServiceResponse<{ authUrl: string; state: string }>> {
//   try {
//     // Generate a new state UUID
//     const state = uuidv4();
    
//     // Create state data with additional metadata
//     // Store the state directly as the key, and the metadata as the value
//     const stateData = {
//       role,
//       timestamp: Date.now(),
//       provider,
//       state // Include the state in the stored data for verification
//     };
    
//     // Store the state with role in Redis
//     await this.redis.set(
//       `oauth_state:${state}`,
//       JSON.stringify(stateData),
//       "EX", 
//       600 // 10 minutes expiration
//     );

//     console.log('Stored state in Redis:', { key: `oauth_state:${state}`, value: stateData });
    
//     // Return the raw state (not the full object) to the client
//     // The client will send this back and we'll use it to look up the full state data

//     // Generate PKCE verifier and challenge
//     const codeVerifier = base64URLEncode(crypto.randomBytes(32));
//     const codeChallenge = base64URLEncode(
//       crypto.createHash('sha256').update(codeVerifier).digest()
//     );
    
//     // Store code verifier for later verification
//     await this.redis.set(
//       `oauth_verifier:${state}`,
//       codeVerifier,
//       "EX",
//       600 // 10 minutes expiration
//     );

//     // Build the OAuth URL with the raw state (not the JSON)
//     const authUrl = this.buildOAuthUrl(provider, redirectUri, state, codeChallenge);
    
//     console.log('Generated OAuth URL with state:', { state, authUrl });
    
//     return this.success({
//       authUrl,
//       state // Return the raw state (not the full state object)
//     });
//   } catch (error) {
//     console.error('Error generating OAuth URL:', error);
//     return this.failure('Failed to generate OAuth URL');
//   }
// }

async generateAuthUrl(
  provider: ProviderEnum,
  redirectUri: string,
  role: RoleEnum
): Promise<ServiceResponse<{ authUrl: string; state: string }>> {
  try {
    // Generate a new state UUID
    const state = uuidv4();
    
    // Create state data with additional metadata
    const stateData = {
      role,
      timestamp: Date.now(),
      provider,
      state // Include the state itself for verification
    };
    
    // Store the state with metadata in Redis
    const redisKey = `oauth_state:${state}`;
    await this.redis.set(
      redisKey,
      JSON.stringify(stateData),
      "EX", 
      600 // 10 minutes expiration
    );

    console.log('Generated and stored OAuth state:', { 
      key: redisKey, 
      state, 
      provider, 
      role 
    });
    
    // Generate PKCE verifier and challenge
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );
    
    // Store code verifier for later verification
    await this.redis.set(
      `oauth_verifier:${state}`,
      codeVerifier,
      "EX",
      600 // 10 minutes expiration
    );

    // Build the OAuth URL
    const authUrl = this.buildOAuthUrl(provider, redirectUri, state, codeChallenge);
    
    console.log('Generated OAuth URL:', { state, provider, authUrl });
    
    return this.success({
      authUrl,
      state // Return the raw state UUID
    });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return this.failure('Failed to generate OAuth URL');
  }
}

  async verifyGoogleToken(
    accessToken: string
  ): Promise<ServiceResponse<OAuthUserData>> {
    try {
      const response = await axios.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const googleUser = response.data;

      const userData: OAuthUserData = {
        id: googleUser.id,
        email: googleUser.email,
        firstName:
          googleUser.given_name || googleUser.name?.split(" ")[0] || "",
        lastName:
          googleUser.family_name ||
          googleUser.name?.split(" ").slice(1).join(" ") ||
          "",
        profilePic: googleUser.picture,
        phoneNumber: "",
        isEmailVerified: googleUser.email_verified || true,
      };

      if (!userData.email || !userData.firstName || !userData.id) {
        return this.failure<OAuthUserData>(
          "Incomplete user data from Google",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }

      return this.success(userData, "Google token verified successfully");
    } catch (error) {
      logger.error("Google token verification failed:", error);
      return this.failure<OAuthUserData>(
        "Invalid Google access token",
        null,
        [StatusCodes.UNAUTHORIZED]
      );
    }
  }

  async verifyFacebookToken(
    accessToken: string
  ): Promise<ServiceResponse<OAuthUserData>> {
    try {
      const response = await axios.get("https://graph.facebook.com/me", {
        params: {
          access_token: accessToken,
          fields: "id,name,email,first_name,last_name,picture",
        },
      });

      const facebookUser = response.data;

      const userData: OAuthUserData = {
        id: facebookUser.id,
        email: facebookUser.email,
        firstName:
          facebookUser.first_name || facebookUser.name?.split(" ")[0] || "",
        lastName:
          facebookUser.last_name ||
          facebookUser.name?.split(" ").slice(1).join(" ") ||
          "",
        profilePic: facebookUser.picture?.data?.url,
        phoneNumber: "",
        isEmailVerified: true,
      };

      if (!userData.email || !userData.firstName || !userData.id) {
        return this.failure<OAuthUserData>(
          "Incomplete user data from Facebook",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }

      return this.success(userData, "Facebook token verified successfully");
    } catch (error) {
      logger.error("Facebook token verification failed:", error);
      return this.failure<OAuthUserData>(
        "Invalid Facebook access token",
        null,
        [StatusCodes.UNAUTHORIZED]
      );
    }
  }

  async verifyLinkedInToken(
    accessToken: string
  ): Promise<ServiceResponse<OAuthUserData>> {
    try {
      const [profileResponse, emailResponse] = await Promise.all([
        axios.get("https://api.linkedin.com/v2/people/~", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        axios.get(
          "https://api.linkedin.com/v2/emailAddresses?q=members&projection=(elements*(handle~))",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ),
      ]);

      const profile = profileResponse.data;
      const emailData = emailResponse.data;

      const userData: OAuthUserData = {
        id: profile.id,
        email: emailData.elements?.[0]?.["handle~"]?.emailAddress,
        firstName:
          profile.firstName?.localized?.en_US ||
          profile.localizedFirstName ||
          "",
        lastName:
          profile.lastName?.localized?.en_US || profile.localizedLastName || "",
        profilePic:
          profile.profilePicture?.["displayImage~"]?.elements?.[0]
            ?.identifiers?.[0]?.identifier,
        phoneNumber: "",
        isEmailVerified: true,
      };

      if (!userData.email || !userData.firstName || !userData.id) {
        return this.failure("Incomplete user data from LinkedIn");
      }

      return this.success(userData, "LinkedIn token verified successfully");
    } catch (error) {
      logger.error("LinkedIn token verification failed:", error);
      return this.failure("Invalid LinkedIn access token");
    }
  }

  async verifyProviderToken(
    provider: ProviderEnum,
    accessToken: string
  ): Promise<ServiceResponse<OAuthUserData>> {
    switch (provider) {
      case ProviderEnum.GOOGLE:
        return this.verifyGoogleToken(accessToken);
      case ProviderEnum.FACEBOOK:
        return this.verifyFacebookToken(accessToken);
      case ProviderEnum.LINKEDIN:
        return this.verifyLinkedInToken(accessToken);
      default:
        return this.failure<OAuthUserData>(
          `Unsupported OAuth provider: ${provider}`,
          null,
          [StatusCodes.BAD_REQUEST]
        );
    }
  }

  async exchangeCodeForToken(
    provider: ProviderEnum,
    code: string,
    redirectUri: string,
    state?: string
  ): Promise<ServiceResponse<OAuthTokenData>> {
    console.log(`Exchanging code for ${provider} token with redirect URI:`, redirectUri);
    try {
      let tokenResponse: any;
      let codeVerifier: string | null = null;

      // Fetch code_verifier from Redis if state exists and provider supports PKCE
      if (state && provider !== ProviderEnum.FACEBOOK) {
        codeVerifier = await this.redis.get(`oauth_verifier:${state}`);
        if (codeVerifier) {
          await this.redis.del(`oauth_verifier:${state}`);
        }
      }

      const clientId = process.env[`${provider}_CLIENT_ID`];
      const clientSecret = process.env[`${provider}_CLIENT_SECRET`];

      if (!clientId || !clientSecret) {
        return this.failure<OAuthTokenData>(
          `Missing ${provider} credentials`,
          null,
          [StatusCodes.INTERNAL_SERVER_ERROR]
        );
      }

      switch (provider) {
        case ProviderEnum.GOOGLE: {
          const tokenEndpoint = "https://oauth2.googleapis.com/token";
          const body = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
            ...(codeVerifier && { code_verifier: codeVerifier }),
          }).toString();

          console.log('Google token request body:', body);

          tokenResponse = await axios.post(tokenEndpoint, body, {
            headers: { 
              "Content-Type": "application/x-www-form-urlencoded",
              "Accept": "application/json"
            },
          });
          break;
        }

        case ProviderEnum.FACEBOOK: {
          tokenResponse = await axios.get("https://graph.facebook.com/v18.0/oauth/access_token", {
            params: {
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: redirectUri,
            },
          });
          break;
        }

        case ProviderEnum.LINKEDIN: {
          const params = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            ...(codeVerifier && { code_verifier: codeVerifier }),
          });

          tokenResponse = await axios.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            params,
            {
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
            }
          );
          break;
        }

        default:
          return this.failure<OAuthTokenData>(
            `Unsupported OAuth provider: ${provider}`,
            null,
            [StatusCodes.BAD_REQUEST]
          );
      }

      const tokenData: OAuthTokenData = {
        accessToken: tokenResponse.data.access_token,
        refreshToken: tokenResponse.data.refresh_token,
        expiresIn: tokenResponse.data.expires_in,
        tokenType: tokenResponse.data.token_type || "Bearer",
      };

      return this.success(tokenData, "Token exchange successful");
    } catch (error: any) {
      console.error(`${provider} token exchange failed:`, error?.response?.data || error);
      return this.failure<OAuthTokenData>(
        `Failed to exchange ${provider} authorization code`,
        null,
        [StatusCodes.INTERNAL_SERVER_ERROR]
      );
    }
  }
    private async generateTokens(
      user: Pick<User, "id" | "email" | "role" | "permissions">
    ): Promise<AuthTokens> {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      };
  
      const accessToken = jwt.sign(payload, jwtConfig.secret, {
        expiresIn: "7d",
      });
  
      const refreshToken = jwt.sign(
        { userId: user.id },
        jwtConfig.refreshSecret,
        {
          expiresIn: "30d",
        }
      );
  
      const decoded = jwt.decode(accessToken) as any;
      const expiresAt = new Date(decoded.exp * 1000);
  
      return { accessToken, refreshToken, expiresAt };
    }

    // In oauth.service.ts
private extractStateUUID(state: string): { stateUUID: string; role?: string } {
  try {
    const parsed = JSON.parse(state);
    if (parsed && typeof parsed === 'object') {
      // Handle both formats:
      // 1. { state: "glb_...", role: "..." }
      // 2. { state: "uuid", role: "..." }
      const stateValue = parsed.state || state;
      return {
        stateUUID: stateValue.startsWith('glb_') ? stateValue : stateValue,
        role: parsed.role
      };
    }
  } catch (e) {
    // Not JSON, use as-is
  }
  return { stateUUID: state };
}
private buildOAuthUrl(
  provider: ProviderEnum,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const encodedRedirectUri = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);

  switch (provider) {
    case ProviderEnum.GOOGLE:
      return (
        'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodedRedirectUri}&` +
        'scope=openid%20email%20profile&' +
        'response_type=code&' +
        'access_type=offline&' +
        'prompt=consent&' +
        `state=${encodedState}&` +
        `code_challenge=${codeChallenge}&` +
        'code_challenge_method=S256'
      );

    case ProviderEnum.FACEBOOK:
      return (
        'https://www.facebook.com/v18.0/dialog/oauth?' +
        `client_id=${process.env.FACEBOOK_CLIENT_ID}&` +
        `redirect_uri=${encodedRedirectUri}&` +
        'scope=email,public_profile&' +
        'response_type=code&' +
        `state=${encodedState}`
      );

    case ProviderEnum.LINKEDIN:
      return (
        'https://www.linkedin.com/oauth/v2/authorization?' +
        `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
        `redirect_uri=${encodedRedirectUri}&` +
        'scope=r_liteprofile%20r_emailaddress&' +
        'response_type=code&' +
        `state=${encodedState}&` +
        `code_challenge=${codeChallenge}&` +
        'code_challenge_method=S256'
      );

    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
}
}

import { PrismaClient, ProviderEnum } from "@prisma/client";
import type { Redis } from "ioredis";
import { BaseService } from "./base";
import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { ServiceResponse } from "../types";
import { logger } from "../utils";
import { OAuthTokenData, OAuthUserData } from "../types/services/auth";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

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

  async startOAuthFlow(
    provider: ProviderEnum,
    code: string,
    redirectUri: string,
    state: string
  ): Promise<ServiceResponse<OAuthUserData & { token: string }>> {

//     const allowedRedirects = [
//   'https://yourapp.com/callback',
//   'glubon://oauth'
// ];
// if (!allowedRedirects.includes(redirectUri)) {
//   return this.failure("Invalid redirect URI");
// }
    try {
      // Verify state to prevent CSRF
      const storedState = await this.redis.get(`oauth_state:${state}`);
      if (!storedState || storedState !== provider) {
        return this.failure<OAuthUserData & { token: string }>(
          "Invalid state parameter",
          null,
          [StatusCodes.BAD_REQUEST]
        );
      }
      await this.redis.del(`oauth_state:${state}`);

      // Exchange code for token
      const tokenResult = await this.exchangeCodeForToken(
        provider,
        code,
        redirectUri,
        state
      );
      if (!tokenResult.success || !tokenResult.data) {
        return this.failure<OAuthUserData & { token: string }>(
          tokenResult.message,
          null,
          [StatusCodes.UNAUTHORIZED]
        );
      }

      const { accessToken } = tokenResult.data;

      // Verify token and get user data
      const userResult = await this.verifyProviderToken(provider, accessToken);
      if (!userResult.success || !userResult.data) {
        return this.failure<OAuthUserData & { token: string }>(
          userResult.message,
          null,
          [StatusCodes.UNAUTHORIZED]
        );
      }

      const userData = userResult.data;

      // Check if user exists or create new user
      let user = await this.prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profilePic: userData.profilePic || "",
            isVerified: userData.isEmailVerified,
            providerAccounts: {
              create: {
                provider,
                providerId: userData.id,
                accessToken,
              },
            },
          },
        });
      } else {
        // Update or link provider account
        await this.prisma.providerAccount.upsert({
          where: {
            provider_providerId: { provider, providerId: userData.id },
          },
          update: { accessToken },
          create: {
            userId: user.id,
            provider,
            providerId: userData.id,
            accessToken,
          },
        });
      }

      // Generate JWT or session token
      const token = await this.generateSessionToken(user.id);

      return this.success(
        { ...userData, token },
        `${provider} OAuth flow completed successfully`
      );
    } catch (error) {
      logger.error(`${provider} OAuth flow failed:`, error);
      if (state) {
  await this.redis.del(`oauth_verifier:${state}`);
}
      return this.failure<OAuthUserData & { token: string }>(
        `Failed to complete ${provider} OAuth flow`,
        null,
        [StatusCodes.INTERNAL_SERVER_ERROR]
      );
    }
  }

async generateAuthUrl(
  provider: ProviderEnum,
  redirectUri: string
): Promise<ServiceResponse<{ authUrl: string; state: string }>> {
  try {
    const state = uuidv4();

    // ---- PKCE: generate verifier & challenge ----
    const codeVerifier = base64URLEncode(crypto.randomBytes(32));
    const codeChallenge = base64URLEncode(sha256(Buffer.from(codeVerifier)));

    // Store verifier for 10 minutes
    await this.redis.set(`oauth_verifier:${state}`, codeVerifier, "EX", 600);

    let authUrl: string;

    switch (provider) {
      case ProviderEnum.GOOGLE:
        authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent("openid email profile")}&` +
          `response_type=code&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=${encodeURIComponent(state)}&` +
          `code_challenge=${codeChallenge}&` +
          `code_challenge_method=S256`;
        break;

      case ProviderEnum.FACEBOOK:
        // Facebook does NOT support PKCE → skip
        authUrl =
          `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${process.env.FACEBOOK_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent("email,public_profile")}&` +
          `response_type=code&` +
          `state=${encodeURIComponent(state)}`;
        break;

      case ProviderEnum.LINKEDIN:
        authUrl =
          `https://www.linkedin.com/oauth/v2/authorization?` +
          `client_id=${process.env.LINKEDIN_CLIENT_ID}&` +
          `redirect_uri=${encodeURIComponent(redirectUri)}&` +
          `scope=${encodeURIComponent("r_liteprofile r_emailaddress")}&` +
          `response_type=code&` +
          `state=${encodeURIComponent(state)}&` +
          `code_challenge=${codeChallenge}&` +
          `code_challenge_method=S256`;
        break;

      default:
        return this.failure<{ authUrl: string; state: string }>(
          `Unsupported OAuth provider: ${provider}`,
          null,
          [StatusCodes.BAD_REQUEST]
        );
    }

    // Store state in Redis with 10-minute expiry
    await this.redis.set(`oauth_state:${state}`, provider, "EX", 600);

    return this.success(
      { authUrl, state },
      "Auth URL generated successfully"
    );
  } catch (error) {
    logger.error(`Failed to generate ${provider} auth URL:`, error);
    return this.failure<{ authUrl: string; state: string }>(
      `Failed to generate ${provider} auth URL`,
      null,
      [StatusCodes.INTERNAL_SERVER_ERROR]
    );
  }
}

  private async generateSessionToken(userId: string): Promise<string> {
    // Implement JWT or session token generation logic here
    // This is a placeholder; replace with your actual token generation
    const token = `jwt_${userId}_${Date.now()}`;
    await this.redis.set(`session:${userId}`, token, "EX", 3600); // 1-hour expiry
    return token;
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
  try {
    let tokenResponse: any;
    let codeVerifier: string | null = null;

    // Fetch code_verifier from Redis if state exists and provider supports PKCE
    if (state && provider !== ProviderEnum.FACEBOOK) {
      codeVerifier = await this.redis.get(`oauth_verifier:${state}`);
      await this.redis.del(`oauth_verifier:${state}`);
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
        const body = {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          ...(codeVerifier && { code_verifier: codeVerifier }),
        };

        tokenResponse = await axios.post("https://oauth2.googleapis.com/token", body, {
          headers: { "Content-Type": "application/json" },
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
          params, // <-- URLSearchParams, not object
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
    logger.error(`${provider} token exchange failed:`, error?.response?.data || error);
    return this.failure<OAuthTokenData>(
      `Failed to exchange ${provider} authorization code`,
      null,
      [StatusCodes.INTERNAL_SERVER_ERROR]
    );
  }
}
}

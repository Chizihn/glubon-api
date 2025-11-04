import express from "express";
import { ProviderEnum } from "@prisma/client";
import { OAuthService } from "../services/oauth";
import { prisma, redis } from "../config";

const router = express.Router();
const oAuthService = new OAuthService(prisma, redis);

// Handle root OAuth callback (e.g., /api/oauth/callback)
router.get("/callback", (req, res) => {
  // Extract the provider from query parameters or default to GOOGLE
  const provider = (req.query.provider as string) || 'google';
  // Redirect to the provider-specific callback URL
  return res.redirect(`/api/oauth/${provider.toLowerCase()}/callback?${new URLSearchParams(req.query as Record<string, string>).toString()}`);
});

// In oauth.ts route handler
router.get("/:provider/callback", async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    console.log('OAuth callback received:', { 
      provider, 
      hasCode: !!code, 
      state
    });

    if (error) {
      const errorMsg = encodeURIComponent(
        typeof error === 'string' ? error : 'Authentication failed'
      );
      return res.redirect(`glubon://oauth?error=${errorMsg}${state ? `&state=${state}` : ''}`);
    }

    if (!code || !state) {
      console.error('Missing required parameters:', { code, state });
      return res.redirect(
        `glubon://oauth?error=${encodeURIComponent('Missing required parameters')}`
      );
    }

    const result = await oAuthService.startOAuthFlow(
      provider.toUpperCase() as ProviderEnum,
      code as string,
      `${process.env.API_BASE_URL}/api/oauth/${provider}/callback`,
      state as string
    );

    if (!result.success || !result.data) {
      console.error('OAuth flow failed:', result.message);
      const errorMsg = encodeURIComponent(result.message || "OAuth authentication failed");
      return res.redirect(`glubon://oauth?error=${errorMsg}&state=${state}`);
    }

    // Success: redirect with tokens and original state
    const redirectUrl = new URL("glubon://oauth");
    redirectUrl.searchParams.append("token", result.data.accessToken);
    
    if (result.data.refreshToken) {
      redirectUrl.searchParams.append("refreshToken", result.data.refreshToken);
    }
    
    // Always include the original state in the redirect
    redirectUrl.searchParams.append("state", state as string);

    console.log('Redirecting to app with success:', redirectUrl.toString());
    return res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Unexpected error in OAuth callback:', error);
    const errorMsg = encodeURIComponent(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    );
    return res.redirect(`glubon://oauth?error=${errorMsg}${req.query.state ? `&state=${req.query.state}` : ''}`);
  }
});

export { router as oauthRestRouter };
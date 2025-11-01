import express from "express";
import { ProviderEnum } from "@prisma/client";
import { OAuthService } from "../services/oauth";
import { prisma, redis } from "../config";

const router = express.Router();
const oAuthService = new OAuthService(prisma, redis);

router.get("/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const { code, state, redirectUri } = req.query;

  // --- Validate required params ---
  if (!code || !state) {
    return res
      .status(400)
      .json({ success: false, message: "Missing code or state" });
  }

  // --- Convert provider param to enum ---
  let providerEnum: ProviderEnum;
  try {
    providerEnum = ProviderEnum[provider.toUpperCase() as keyof typeof ProviderEnum];
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid provider" });
  }

  // --- Call OAuth flow ---
  const result = await oAuthService.startOAuthFlow(
    providerEnum,
    code as string,
    (redirectUri as string) ||
      `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`,
    state as string
  );

  // --- Handle failure ---
  if (!result.success || !result.data) {
    const errorMsg = encodeURIComponent(result.message ?? "OAuth failed");
    return res.redirect(`glubon://oauth?error=${errorMsg}`);
  }

  // --- Success: redirect with token + state ---
  const { token } = result.data; // <-- token comes from startOAuthFlow
  const encodedToken = encodeURIComponent(token);
  const encodedState = encodeURIComponent(state as string);

  return res.redirect(`glubon://oauth?token=${encodedToken}&state=${encodedState}`);
});

export { router as oauthRestRouter };
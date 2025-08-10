import express from "express";
import { ProviderEnum } from "@prisma/client";
import { OAuthService } from "../../services/oauth";
import { prisma, redis } from "../../config";

const router = express.Router();
const oAuthService = new OAuthService(prisma, redis);

router.get("/:provider/callback", async (req, res) => {
  const { provider } = req.params;
  const { code, state, redirectUri } = req.query;

  if (!code || !state) {
    return res
      .status(400)
      .json({ success: false, message: "Missing code or state" });
  }

  let providerEnum: ProviderEnum;
  try {
    providerEnum =
      ProviderEnum[provider.toUpperCase() as keyof typeof ProviderEnum];
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid provider" });
  }

  const result = await oAuthService.startOAuthFlow(
    providerEnum,
    code as string,
    (redirectUri as string) ||
      req.protocol + "://" + req.get("host") + req.originalUrl,
    state as string
  );

  if (!result.success) {
    // Redirect to app with error (optional, adjust as needed)
    return res.redirect(
      `glubon://oauth?error=${encodeURIComponent(result.message)}`
    );
  }

  // Redirect to app with token
  return res.redirect(
    `glubon://oauth?token=${encodeURIComponent(result.data?.token || "")}`
  );
});

export default router;

import { CorsOptions } from "cors";
import { appConfig } from ".";

export const corsConfig: CorsOptions = {
  origin: appConfig.isDevelopment
    ? true
    : [appConfig.frontendUrl, appConfig.apiUrl],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 200,
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "apollo-require-preflight",
  ],
};

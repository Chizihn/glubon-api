// src/config/index.ts
import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default("http://localhost:4000"),

  // Database
  DATABASE_URL: z.string().min(1, "Database URL is required"),

  // Redis
  REDIS_HOST: z.string().min(1, "Redis URL is required"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT secret must be at least 32 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT refresh secret must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS Access Key ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS Secret Access Key is required"),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_S3_BUCKET: z.string().min(1, "AWS S3 Bucket is required"),

  // Email
  EMAIL_HOST: z.string().min(1, "Email host is required"),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().email("Valid email user is required"),
  EMAIL_PASS: z.string().min(1, "Email password is required"),
  EMAIL_FROM: z.string().min(1, "Email from address is required"),

  // Frontend
  FRONTEND_URL: z.string().url("Valid frontend URL is required"),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  CORS_ORIGIN: z.string(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),

  // File Upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  MAX_FILES_PER_UPLOAD: z.coerce.number().default(10),

  // Optional
  GOOGLE_MAPS_API_KEY: z.string().optional(),
});

// Validate environment variables
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error("❌ Invalid environment variables:");
  console.error(envValidation.error.format());
  process.exit(1);
}

export const config = envValidation.data;

// Database configuration
export const databaseConfig = {
  url: config.DATABASE_URL,
  // Add any additional Prisma configurations here
};

// Redis configuration
export const redisConfig = {
  url: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
};

// JWT configuration
export const jwtConfig = {
  secret: config.JWT_SECRET,
  refreshSecret: config.JWT_REFRESH_SECRET,
  expiresIn: config.JWT_EXPIRES_IN,
  refreshExpiresIn: config.JWT_REFRESH_EXPIRES_IN,
};

// AWS S3 configuration
export const s3Config = {
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  region: config.AWS_REGION,
  bucket: config.AWS_S3_BUCKET,
};

// Email configuration
export const emailConfig = {
  host: config.EMAIL_HOST,
  port: config.EMAIL_PORT,
  secure: config.EMAIL_PORT === 465,
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS,
  },
  from: config.EMAIL_FROM,
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
};

// File upload configuration
export const uploadConfig = {
  maxFileSize: config.MAX_FILE_SIZE,
  maxFiles: config.MAX_FILES_PER_UPLOAD,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/avi",
    "video/mov",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

// Security configuration
export const securityConfig = {
  bcryptRounds: config.BCRYPT_ROUNDS,
  sessionSecret: config.JWT_SECRET,
};

// Application configuration
export const appConfig = {
  name: "Glubon API",
  version: "1.0.0",
  description: "Property Rental Platform for Nigeria",
  port: config.PORT,
  env: config.NODE_ENV,
  apiUrl: config.NODE_ENV === "development" ? `localhost:${config.PORT}` : config.API_BASE_URL,
  frontendUrl: config.FRONTEND_URL,
  isDevelopment: config.NODE_ENV === "development",
  isProduction: config.NODE_ENV === "production",
  isTest: config.NODE_ENV === "test",
};

// GraphQL configuration
export const graphqlConfig = {
  playground: config.NODE_ENV === "development",
  introspection: config.NODE_ENV !== "production",
  debug: config.NODE_ENV === "development",
};

export default config;

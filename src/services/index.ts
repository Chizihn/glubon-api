// src/services/index.ts
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { emailServiceSingleton } from "./email";
import { AuthService } from "./auth";
import { UserService } from "./user";
import { UploadService } from "./upload-service";
import { NotificationService } from "./notification";
import { OAuthService } from "./oauth";
import { PropertyService } from "./property";
import { AdminService } from "./admin";
import { ChatService } from "./chat";

export interface Services {
  authService: AuthService;
  adminService: AdminService;
  oAuthService: OAuthService;
  userService: UserService;
  chatService: ChatService;
  propertyService: PropertyService;
  uploadService: UploadService;
  emailService: typeof emailServiceSingleton;
  notificationService: NotificationService;
}

export function createServices(prisma: PrismaClient, redis: Redis): Services {
  // Initialize services with proper dependencies
  const emailService = emailServiceSingleton;
  const authService = new AuthService(prisma, redis);
  const oAuthService = new OAuthService(prisma, redis);
  const userService = new UserService(prisma, redis);
  const propertyService = new PropertyService(prisma, redis);
  const uploadService = new UploadService(prisma);
  const notificationService = new NotificationService(prisma, redis);
  const chatService = new ChatService(prisma, redis);
  const adminService = new AdminService(prisma, redis);

  return {
    authService,
    userService,
    oAuthService,
    propertyService,
    uploadService,
    emailService,
    notificationService,
    chatService,
    adminService,
  };
}

// src/services/index.ts
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { emailServiceSingleton } from "./email";
import { AuthService } from "./auth";
import { UserService } from "./user";
import { NotificationService } from "./notification";
import { OAuthService } from "./oauth";
import { PropertyService } from "./property";
import { AdminUsersService } from "./admin-user";
import { AdminStatsService } from "./admin-stats";
import { ConversationService } from "./conversation";
import { TransactionService } from "./transaction";
import { SubaccountService } from "./subaccount";

export interface Services {
  authService: AuthService;
  oAuthService: OAuthService;
  userService: UserService;
  adminUserService: AdminUsersService;
  adminStatsService: AdminStatsService;
  conversationService: ConversationService;
  propertyService: PropertyService;
  emailService: typeof emailServiceSingleton;
  notificationService: NotificationService;
  transactionService: TransactionService;
  subaccountService: SubaccountService;
}

export function createServices(prisma: PrismaClient, redis: Redis): Services {
  // Initialize services with proper dependencies
  const emailService = emailServiceSingleton;
  const authService = new AuthService(prisma, redis);
  const oAuthService = new OAuthService(prisma, redis);
  const userService = new UserService(prisma, redis);
  const propertyService = new PropertyService(prisma, redis);
  const notificationService = new NotificationService(prisma, redis);
  const adminUserService = new AdminUsersService(prisma, redis);
  const adminStatsService = new AdminStatsService(prisma, redis);
  const conversationService = new ConversationService(prisma, redis);
  const transactionService = new TransactionService(prisma, redis);
  const subaccountService = new SubaccountService(prisma, redis);

  return {
    authService,
    oAuthService,
    userService,
    adminUserService,
    adminStatsService,
    conversationService,
    propertyService,
    emailService,
    notificationService,
    transactionService,
    subaccountService,
  };
}

// src/services/index.ts
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { emailServiceSingleton } from "./email";
import { AuthService } from "./auth";
import { UserService } from "./user";
import { NotificationService } from "./notification";
import { OAuthService } from "./oauth";
import { PropertyService } from "./property";
import { UnitService } from "./unit";
import { AdminUsersService } from "./admin-user";
import { AdminStatsService } from "./admin-stats";
import { ConversationService } from "./conversation";
import { TransactionService } from "./transaction";
import { AdminPropertyService } from "./admin-property";
import { BookingService } from "./booking";
import { PlatformService } from "./platform-service";
import { SubaccountService } from "./subaccount";
import { PresenceService } from "./presence";
import { AdService } from "./ad";
import { AdAnalyticsService } from "./ad-analytics";

export interface Services {
  authService: AuthService;
  oAuthService: OAuthService;
  userService: UserService;
  adminUserService: AdminUsersService;
  adminStatsService: AdminStatsService;
  adminPropertyService: AdminPropertyService;
  bookingService: BookingService;
  platformService: PlatformService;
  conversationService: ConversationService;
  propertyService: PropertyService;
  unitService: UnitService;
  emailService: typeof emailServiceSingleton;
  notificationService: NotificationService;
  transactionService: TransactionService;
  subaccountService: SubaccountService;
  presenceService: PresenceService;
  adService: AdService;
  adAnalyticsService: AdAnalyticsService;
}

export function createServices(prisma: PrismaClient, redis: Redis): Services {
  // Initialize services with proper dependencies
  const emailService = emailServiceSingleton;
  const authService = new AuthService(prisma, redis);
  const oAuthService = new OAuthService(prisma, redis);
  const userService = new UserService(prisma, redis);
  const propertyService = new PropertyService(prisma, redis);
  const unitService = new UnitService(prisma, redis);
  const adminPropertyService = new AdminPropertyService(prisma, redis);
  const bookingService = new BookingService(prisma, redis);
  const platformService = new PlatformService(prisma, redis);
  const notificationService = new NotificationService(prisma, redis);
  const adminUserService = new AdminUsersService(prisma, redis);
  const adminStatsService = new AdminStatsService(prisma, redis);
  const conversationService = new ConversationService(prisma, redis);
  const transactionService = new TransactionService(prisma, redis);
  const subaccountService = new SubaccountService(prisma, redis);
  const presenceService = new PresenceService(prisma, redis);
  const adService = new AdService(prisma, redis);
  const adAnalyticsService = new AdAnalyticsService(prisma, redis);

  return {
    authService,
    oAuthService,
    userService,
    adminUserService,
    adminStatsService,
    adminPropertyService,
    bookingService,
    platformService,
    conversationService,
    propertyService,
    unitService,
    emailService,
    notificationService,
    transactionService,
    subaccountService,
    presenceService,
    adService,
    adAnalyticsService
  };
}

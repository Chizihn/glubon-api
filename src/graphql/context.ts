import { Request } from "express";
import { User } from "@prisma/client";
import { Context } from "../types";
import { getContainer } from "../services";
import { 
  AuthService, 
  OAuthService, 
  UserService, 
  AdminUsersService, 
  AdminStatsService, 
  AdminPropertyService, 
  BookingService, 
  PlatformService, 
  ConversationService, 
  PropertyService, 
  UnitService, 
  NotificationService, 
  TransactionService, 
  SubaccountService, 
  PresenceService, 
  AdService, 
  AdAnalyticsService 
} from "../services";
import { emailServiceSingleton } from "../services/email";

type ServiceKey = 
  | 'authService' | 'oAuthService' | 'userService' | 'adminUserService' 
  | 'adminStatsService' | 'adminPropertyService' | 'bookingService' 
  | 'platformService' | 'conversationService' | 'propertyService' 
  | 'unitService' | 'emailService' | 'notificationService' 
  | 'transactionService' | 'subaccountService' | 'presenceService' 
  | 'adService' | 'adAnalyticsService';

type ServiceMap = {
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
};

// Extend the Context type to include our getService method
declare module "../types" {
  interface Context {
    getService: <K extends keyof ServiceMap>(key: K) => ServiceMap[K];
  }
}

/**
 * Get a service from the container with proper typing
 */
function getService<K extends keyof ServiceMap>(key: K): ServiceMap[K] {
  const container = getContainer();
  return container.resolve<ServiceMap[K]>(key);
}

export function createGraphQLContext(
  req?: Request,
  user?: Partial<User> | null
): Context {
  const context: any = {
    user: (user as User) || req?.user || null,
    // For backward compatibility
    prisma: getContainer().getPrisma(),
    redis: getContainer().getRedis(),
    // For backward compatibility
    services: {
      get authService() { return getService('authService'); },
      get oAuthService() { return getService('oAuthService'); },
      get userService() { return getService('userService'); },
      get adminUserService() { return getService('adminUserService'); },
      get adminStatsService() { return getService('adminStatsService'); },
      get adminPropertyService() { return getService('adminPropertyService'); },
      get bookingService() { return getService('bookingService'); },
      get platformService() { return getService('platformService'); },
      get conversationService() { return getService('conversationService'); },
      get propertyService() { return getService('propertyService'); },
      get unitService() { return getService('unitService'); },
      get emailService() { return getService('emailService'); },
      get notificationService() { return getService('notificationService'); },
      get transactionService() { return getService('transactionService'); },
      get subaccountService() { return getService('subaccountService'); },
      get presenceService() { return getService('presenceService'); },
      get adService() { return getService('adService'); },
      get adAnalyticsService() { return getService('adAnalyticsService'); },
    }
  };

  // Add the getService method to the context
  context.getService = <K extends keyof ServiceMap>(key: K): ServiceMap[K] => getService(key);

  if (req !== undefined) {
    context.req = req;
  }

  return context as Context;
}

// src/services/index.ts
import { Container } from '../container';
import { emailServiceSingleton } from "./email";

// Import and re-export all service types
export * from "./auth";
export * from "./user";
export * from "./notification";
export * from "./oauth";
export * from "./property";
export * from "./unit";
export * from "./admin-user";
export * from "./admin-stats";
export * from "./conversation";
export * from "./transaction";
export * from "./admin-property";
export * from "./booking";
export * from "./platform-service";
export * from "./subaccount";
export * from "./presence";
export * from "./ad";
export * from "./ad-analytics";
export * from "./payment";

// Import service implementations for internal use
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
import { PaystackService } from "./payment";
import { SettingsService } from "./setting";

// Export the Container class for type information
export { Container } from '../container';

// This will be set when the app starts
let containerInstance: Container | null = null;

export function getContainer(): Container {
  if (!containerInstance) {
    throw new Error('Container has not been initialized. Call setContainer() first.');
  }
  return containerInstance;
}

export function setContainer(container: Container): void {
  containerInstance = container;
}

// Register all services with the container
export function registerServices(container: Container): void {
  // Register singleton services
  container.register('emailService', () => emailServiceSingleton);
  
  // Register other services
  container.register('authService', (container) => 
    new AuthService(container.getPrisma(), container.getRedis())
  );
  
  container.register('oAuthService', (container) => 
    new OAuthService(container.getPrisma(), container.getRedis())
  );
  
  container.register('userService', (container) => 
    new UserService(container.getPrisma(), container.getRedis())
  );
  
  container.register('propertyService', (container) => 
    new PropertyService(container.getPrisma(), container.getRedis())
  );
  
  container.register('unitService', (container) => 
    new UnitService(container.getPrisma(), container.getRedis())
  );
  
  container.register('adminPropertyService', (container) => 
    new AdminPropertyService(container.getPrisma(), container.getRedis())
  );
  
  container.register('bookingService', (container) => 
    new BookingService(container.getPrisma(), container.getRedis())
  );
  
  container.register('platformService', (container) => 
    new PlatformService(container.getPrisma(), container.getRedis())
  );
  
  container.register('notificationService', (container) => 
    new NotificationService(container.getPrisma(), container.getRedis())
  );
  
  container.register('adminUserService', (container) => 
    new AdminUsersService(container.getPrisma(), container.getRedis())
  );
  
  container.register('adminStatsService', (container) => 
    new AdminStatsService(container.getPrisma(), container.getRedis())
  );
  
  container.register('conversationService', (container) => 
    new ConversationService(container.getPrisma(), container.getRedis())
  );
  
  container.register('transactionService', (container) => 
    new TransactionService(container.getPrisma(), container.getRedis())
  );
  
  container.register('subaccountService', (container) => 
    new SubaccountService(container.getPrisma(), container.getRedis())
  );
  
  container.register('presenceService', (container) => 
    new PresenceService(container.getPrisma(), container.getRedis())
  );
  
  container.register('adService', (container) => 
    new AdService(container.getPrisma(), container.getRedis())
  );
  
  container.register('adAnalyticsService', (container) => 
    new AdAnalyticsService(container.getPrisma(), container.getRedis())
  );

  container.register('paystackService', (container) => 
    new PaystackService(container.getPrisma(), container.getRedis())
  );
  
  container.register('settingsService', (container) => 
    new SettingsService(container.getPrisma(), container.getRedis())
  );
}

// For backward compatibility
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
  paystackService: PaystackService;
  settingsService: SettingsService;
}

// Legacy function for backward compatibility
export function createServices(prisma: any, redis: any): Services {
  const container = getContainer();
  return {
    authService: container.resolve('authService'),
    oAuthService: container.resolve('oAuthService'),
    userService: container.resolve('userService'),
    adminUserService: container.resolve('adminUserService'),
    adminStatsService: container.resolve('adminStatsService'),
    adminPropertyService: container.resolve('adminPropertyService'),
    bookingService: container.resolve('bookingService'),
    platformService: container.resolve('platformService'),
    conversationService: container.resolve('conversationService'),
    propertyService: container.resolve('propertyService'),
    unitService: container.resolve('unitService'),
    emailService: container.resolve('emailService'),
    notificationService: container.resolve('notificationService'),
    transactionService: container.resolve('transactionService'),
    subaccountService: container.resolve('subaccountService'),
    presenceService: container.resolve('presenceService'),
    adService: container.resolve('adService'),
    adAnalyticsService: container.resolve('adAnalyticsService'),
    paystackService: container.resolve('paystackService'),
    settingsService: container.resolve('settingsService'),
  };
}

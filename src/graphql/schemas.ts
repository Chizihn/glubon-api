// src/graphql/schema.ts
import "reflect-metadata";
import { PubSub } from "graphql-subscriptions";
import { buildSchema } from "type-graphql";
import { GraphQLUpload } from "graphql-upload-ts";
import { GraphQLDecimal } from "./scalars/Decimal";
import { AuthResolver } from "../modules/auth/auth.resolver";
import { UserResolver } from "../modules/user/user.resolver";
import { appConfig } from "../config";
import { PropertyResolver } from "../modules/property/property.resolver";
import { AdminResolver } from "../modules/admin/admin.resolver";
import { NotificationResolver } from "../modules/notification/notification.resolver";
import { BookingResolver } from "../modules/booking/booking.resolver";
import { DisputeResolver } from "../modules/dispute/dispute.resolver";
import { TransactionResolver } from "../modules/transaction/transaction.resolver";
import { PresenceResolver } from "../modules/presence/presence.resolver";
import { ContentResolver } from "../modules/content/content.resolver";
import { ChatResolver } from "../modules/chat/chat.resolver";
import { FAQResolver } from "../modules/faq";
import { AuditLogResolver } from "../modules/audit-log";
import { AdResolver } from "../modules/ad";
import { AdAnalyticsResolver } from "../modules/ad-analytics";
import { SettingsResolver } from "../modules/setting/setting.resolver";
import { SubaccountResolver } from "../modules/subaccount/subaccount.resolver";
import { UnitResolver } from "../modules/unit/unit.resolver";
import { AnalyticsResolver } from "../modules/analytics/analytics.resolver";
import { AIResolver } from "../modules/ai/ai.resolver";
import { TicketResolver } from "../modules/tickets/ticket.resolver";
// Auth checking is handled by the AuthMiddleware

export async function createGraphQLSchema() {
  // Use the shared pubSub instance
  const { pubSub } = await import("../utils/index.js");

  return await buildSchema({
    scalarsMap: [
      { type: Object, scalar: GraphQLDecimal },
      { type: Object, scalar: GraphQLUpload },
    ],
    resolvers: [
      AuthResolver,
      UserResolver,
      PropertyResolver,
      AdminResolver,
      NotificationResolver,
      ChatResolver,
      BookingResolver,
      DisputeResolver,
      TransactionResolver,
      PresenceResolver,
      ContentResolver,
      TransactionResolver,
      AuditLogResolver,
      FAQResolver,
      AdResolver,
      AdAnalyticsResolver,
      SettingsResolver,
      SubaccountResolver,
      UnitResolver,
      AnalyticsResolver,
      AIResolver,
      TicketResolver,
    ],
    validate: false,
    pubSub: pubSub as any,
    emitSchemaFile: appConfig.isDevelopment ? "schema.gql" : false,
    // dateScalarMode: "isoDate",
  });
}

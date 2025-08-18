// src/graphql/schema.ts
import "reflect-metadata";
import { PubSub } from "graphql-subscriptions";
import { buildSchema } from "type-graphql";
import { AuthResolver } from "../modules/auth/auth.resolver";
import { UserResolver } from "../modules/user/user.resolver";
import { appConfig } from "../config";
import { PropertyResolver } from "../modules/property/property.resolver";
import { AdminResolver } from "../modules/admin/admin.resolver";
import { NotificationResolver } from "../modules/notification/notification.resolver";
import { ChatResolver } from "../modules/conversation/conversation.resolver";
import { BookingResolver } from "../modules/booking/booking.resolver";
import { DisputeResolver } from "../modules/dispute/dispute.resolver";
import { WalletResolver } from "../modules/wallet/wallet.resolver";
import { TransactionResolver } from "../modules/transaction/transaction.resolver";
import { PresenceResolver } from "../modules/presence/presence.resolver";
// Auth checking is handled by the AuthMiddleware

export async function createGraphQLSchema() {
  const pubSub = new PubSub() as any;

  return await buildSchema({
    resolvers: [
      AuthResolver,
      UserResolver,
      PropertyResolver,
      AdminResolver,
      NotificationResolver,
      ChatResolver,
      BookingResolver,
      DisputeResolver,
      WalletResolver,
      TransactionResolver,
      PresenceResolver,
    ],
    validate: false,
    pubSub,
    emitSchemaFile: appConfig.isDevelopment ? "schema.gql" : false,
    // dateScalarMode: "isoDate",
  });
}

// src/graphql/server.ts
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from "@apollo/server/plugin/landingPage/default";
import { GraphQLError, GraphQLSchema } from "graphql";
import { Server } from "http";
import { Context } from "../types";
import { appConfig } from "../config";
import { logger } from "../utils";

export async function createApolloServer(
  schema: GraphQLSchema,
  httpServer?: Server
) {
  const apolloServer = new ApolloServer<Context>({
    schema,
    plugins: [
      ...(httpServer ? [ApolloServerPluginDrainHttpServer({ httpServer })] : []),
      // Enable Apollo Sandbox in production
      appConfig.isDevelopment
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true })
        : ApolloServerPluginLandingPageProductionDefault({
            embed: true,
            graphRef: 'your-graph-id@current', // Optional: for Apollo Studio integration
          }),
    ],
    introspection: true, // You already have this - keep it!
    includeStacktraceInErrorResponses: appConfig.isDevelopment,
    csrfPrevention: true,
    cache: 'bounded',
    allowBatchedHttpRequests: true,
    formatError: (err) => {
      const originalError =
        (err instanceof GraphQLError && err.originalError) || undefined;

      logger.error("GraphQL Error:", {
        message: err.message,
        code: err.extensions?.code,
        stack: appConfig.isDevelopment ? originalError?.stack : undefined,
      });

      return {
        message: err.message,
        code: err.extensions?.code,
        ...(appConfig.isDevelopment && { stack: originalError?.stack }),
      };
    },
  });

  await apolloServer.start();
  return apolloServer;
}
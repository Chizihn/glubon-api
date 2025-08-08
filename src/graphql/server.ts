// src/graphql/server.ts
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
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
    plugins: httpServer
      ? [ApolloServerPluginDrainHttpServer({ httpServer })]
      : [],
    introspection: appConfig.isDevelopment,
    includeStacktraceInErrorResponses: appConfig.isDevelopment,
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

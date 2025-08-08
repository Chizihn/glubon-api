// src/app.ts
import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet, { HelmetOptions } from "helmet";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { expressMiddleware } from "@as-integrations/express5";
import { createGraphQLSchema } from "./graphql/schemas";
import { errorHandler } from "./middleware/errorHandler";
import { createServices } from "./services";
import { appConfig, corsConfig, prisma, redis } from "./config";
import { createApolloServer } from "./graphql/server";
import { createWebSocketServer } from "./graphql/websocket";
import { rateLimiterMiddleware } from "./middleware/rateLimiter";
import { graphqlUploadExpress } from "graphql-upload-ts";
import { createGraphQLContext } from "./graphql/context";
import { logger } from "./utils";
import { upload } from "./middleware/multer";

export async function createApp() {
  try {
    // Initialize Express app
    const app = express();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize services
    const services = createServices(prisma, redis);

    // Create GraphQL schema (single source of truth)
    const schema = await createGraphQLSchema();

    // Create Apollo Server
    const apolloServer = await createApolloServer(schema, httpServer);

    // Create WebSocket server
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: "/graphql",
    });

    // Set up WebSocket server for subscriptions
    const wsCleanup = await createWebSocketServer(wsServer, schema, services);

    // Security middleware
    // src/app.ts
    app.use(
      helmet({
        contentSecurityPolicy:
          appConfig.env === "production" ? undefined : false,
        crossOriginEmbedderPolicy: false,
      } as HelmetOptions)
    );
    // CORS
    app.use(cors(corsConfig));

    // Rate limiting
    // app.use(rateLimiterMiddleware);

    // Body parsing
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: appConfig.env,
        services: {
          database: "connected",
          redis: redis.status,
        },
      });
    });

    app.use(
      graphqlUploadExpress({
        maxFileSize: 50 * 1024 * 1024,
        maxFiles: 21,
        overrideSendResponse: false,
      })
    );
    app.use(upload);

    // GraphQL endpoint
    app.use(
      "/graphql",
      expressMiddleware(apolloServer, {
        context: async ({ req }) => {
          return createGraphQLContext(services, req);
        },
      })
    );

    // Error handling middleware
    app.use(errorHandler);

    // Graceful shutdown function
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close HTTP server
        httpServer.close(() => {
          logger.info("HTTP server closed");
        });

        // Close Apollo Server
        await apolloServer.stop();
        logger.info("Apollo Server stopped");

        // Close WebSocket server
        if (wsCleanup) {
          await wsCleanup.dispose();
          logger.info("WebSocket server closed");
        }

        // Close database connections
        await prisma.$disconnect();
        logger.info("Database disconnected");

        // Close Redis connection
        redis.disconnect();
        logger.info("Redis disconnected");

        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    return {
      app,
      httpServer,
      apolloServer,
      wsServer,
      wsCleanup,
      services,
      gracefulShutdown,
    };
  } catch (error) {
    logger.error("Failed to create app:", error);
    throw error;
  }
}

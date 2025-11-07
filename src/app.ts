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
import { createServices, registerServices, setContainer } from "./services";
import { createWebhookRouter } from "./routes/webhook";
import { Container } from "./container";
import { registerRepositories } from "./repository/index";
import { appConfig, corsConfig, prisma, redis } from "./config";
import { createApolloServer } from "./graphql/server";
import { createWebSocketServer } from "./graphql/websocket";
import { graphqlUploadExpress } from "graphql-upload-ts";
import { createGraphQLContext } from "./graphql/context";
import { logger } from "./utils";
import { oauthRestRouter } from "./routes/oauth";
import { initializeWorkers } from "./workers";

export async function createApp() {
  try {
    // Initialize Express app
    const app = express();

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize container with prisma and redis
    const container = Container.getInstance(prisma, redis);

    // Set the container instance for services to use
    setContainer(container);

    // Register all services with the container
    registerServices(container);
    
    // Register all repositories with the container
    registerRepositories(container);

    // For backward compatibility
    const services = createServices(prisma, redis);

    // Initialize background workers
    if (process.env.NODE_ENV !== "test") {
      initializeWorkers(prisma);
    }

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

    // Skip helmet for GraphQL to allow embedded Apollo landing page
    app.use((req, res, next) => {
      if (req.path === "/graphql") {
        return next();
      }

      helmet({
        contentSecurityPolicy:
          appConfig.env === "production" ? undefined : false,
        crossOriginEmbedderPolicy: false,
      } as HelmetOptions)(req, res, next);
    });

    // CORS
    app.use(cors(corsConfig));

    // Body parsing - Configure before GraphQL upload middleware
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // OAuth REST endpoints
    app.use("/api/oauth", oauthRestRouter);

    // Paystack webhook endpoint
    app.use("/api/webhook", createWebhookRouter(prisma, redis));
    app.get("/payment-callback", async (req, res) => {
      const { reference, status } = req.query;

      try {
        // Get booking ID from transaction reference for better UX
        const transaction = await prisma.transaction.findUnique({
          where: { reference: reference as string },
          include: { booking: true },
        });

        const bookingId = transaction?.booking?.id;
        const bookingParam = bookingId ? `&bookingId=${bookingId}` : "";

        if (status === "success") {
          res.redirect(
            `glubon://payment/successful?reference=${reference}${bookingParam}`
          );
        } else {
          res.redirect(
            `glubon://payment/failed?reference=${reference}${bookingParam}`
          );
        }
      } catch (error) {
        console.error("Payment callback error:", error);
        // Fallback to basic redirect
        if (status === "success") {
          res.redirect(`glubon://payment/successful?reference=${reference}`);
        } else {
          res.redirect(`glubon://payment/failed?reference=${reference}`);
        }
      }
    });

    // Root endpoint
    app.get("/", (req, res) => {
      res.status(200).json({
        message: "Glubon API Server",
        version: "1.0.0",
        endpoints: {
          graphql: "/graphql",
          health: "/health",
          webhook: "/api/webhook",
          oauth: "/api/oauth",
        },
      });
    });

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

    // app.use(upload);

    // GraphQL endpoint with file upload support
    app.use(
      "/graphql",
      // Apply the graphqlUploadExpress middleware first to handle file uploads
      graphqlUploadExpress({
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 21,
      }),
      // Then apply the Apollo Server middleware
      expressMiddleware(apolloServer, {
        context: async ({ req }) => {
          // Create GraphQL context
          const context = createGraphQLContext(req, req?.user);
          return context;
        },
      })
    );

    // Error handling middleware
    app.use(errorHandler);

    // Graceful shutdown function
    const gracefulShutdown = async (signal: string) => {
      // logger.info(`Received ${signal}. Starting graceful shutdown...`);

      try {
        // Close HTTP server
        httpServer.close(() => {
          // logger.info("HTTP server closed");
        });

        // Close Apollo Server
        await apolloServer.stop();
        // logger.info("Apollo Server stopped");

        // Close WebSocket server
        if (wsCleanup) {
          await wsCleanup.dispose();
          // logger.info("WebSocket server closed");
        }

        // Close database connections
        await prisma.$disconnect();
        // logger.info("Database disconnected");

        // Close Redis connection
        redis.disconnect();
        // logger.info("Redis disconnected");

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

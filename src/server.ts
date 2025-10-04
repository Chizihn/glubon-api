// src/server.ts
import { createApp } from "./app";
import { appConfig } from "./config";
import { logger } from "./utils";

async function bootstrap() {
  try {
    const { httpServer, gracefulShutdown } = await createApp();

    // Handle process signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (error) => {
      logger.error("Unhandled Rejection:", error);
      process.exit(1);
    });

    // Start server
    httpServer.listen(appConfig.port, () => {
//       logger.info(`
// 🚀 Glubon API Server is running!
// 📍 Environment: ${appConfig.env}
// 🌐 GraphQL: http://localhost:${appConfig.port}/graphql
// 📊 Health Check: http://localhost:${appConfig.port}/health
// 🔌 WebSocket: ws://localhost:${appConfig.port}/graphql
// ${
//   appConfig.isDevelopment
//     ? `🎮 GraphQL Playground: http://localhost:${appConfig.port}/graphql`
//     : ""
// }
//       `);
    });
  } catch (error) {
    // logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Initialize the application
bootstrap().catch((error) => {
  // logger.error("Bootstrap failed:", error);
  process.exit(1);
});

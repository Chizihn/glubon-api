// src/server.ts
import { createApp } from "./app";
import { appConfig, config } from "./config";
import { logger } from "./utils";
import { PaymentWorker } from "./jobs/workers/payment.worker";
import { Container } from "typedi";

async function bootstrap() {
  try {
    const { httpServer, gracefulShutdown } = await createApp();
    


    // Initialize workers
    const paymentWorker = Container.get(PaymentWorker);

    // Handle process signals
    process.on("SIGTERM", async () => {
      await paymentWorker.close();
      gracefulShutdown("SIGTERM");
    });
    process.on("SIGINT", async () => {
      await paymentWorker.close();
      gracefulShutdown("SIGINT");
    });

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
    const port = process.env.PORT || appConfig.port;
    httpServer.listen(port, () => {
      logger.info(`
🚀 Glubon API Server is running!
📍 Environment: ${appConfig.env}
🌐 GraphQL: ${config.API_BASE_URL}/graphql
📊 Health Check: ${config.API_BASE_URL}/health
🔌 WebSocket: ws://${config.API_BASE_URL}/graphql
${
  appConfig.isDevelopment
    ? `🎮 GraphQL Playground: http://${config.API_BASE_URL}/graphql`
    : ""
}
      `);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Initialize the application
bootstrap().catch((error) => {
  logger.error("Bootstrap failed:", error);
  process.exit(1);
});

import winston from "winston";
import { appConfig } from "../config";

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return log;
  })
);

export const logger = winston.createLogger({
  level: appConfig.isDevelopment ? "debug" : "info",
  format: logFormat,
  defaultMeta: { service: "graphql-api" },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: appConfig.isDevelopment ? consoleFormat : logFormat,
    }),

    // File transports for production
    ...(appConfig.isProduction
      ? [
          new winston.transports.File({
            filename: "logs/error.log",
            level: "error",
          }),
          new winston.transports.File({
            filename: "logs/combined.log",
          }),
        ]
      : []),
  ],
});

// Handle uncaught exceptions and unhandled rejections
if (appConfig.isProduction) {
  logger.exceptions.handle(
    new winston.transports.File({ filename: "logs/exceptions.log" })
  );
  logger.rejections.handle(
    new winston.transports.File({ filename: "logs/rejections.log" })
  );
}

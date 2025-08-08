import { useServer } from "graphql-ws/use/ws"; // Correct import path
import type { Disposable } from "graphql-ws";
import { WebSocketServer } from "ws";
import { GraphQLSchema } from "graphql";
import { Services } from "../services";
import { WebSocketContext } from "../types";
import { prisma, redis } from "../config";
import { logger } from "../utils";

export async function createWebSocketServer(
  wsServer: WebSocketServer,
  schema: GraphQLSchema,
  services: Services
): Promise<Disposable> {
  const serverCleanup = useServer(
    {
      schema,
      context: async (
        ctx: { connectionParams?: Record<string, any> },
        msg: any,
        args: any
      ): Promise<WebSocketContext> => {
        const token = ctx.connectionParams?.authorization?.replace(
          "Bearer ",
          ""
        );
        let user = null;

        if (token) {
          try {
            const decoded = await services.authService.verifyToken(token);
            user = await prisma.user.findUnique({
              where: { id: decoded.userId },
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                permissions: true,
                isVerified: true,
                isActive: true,
              },
            });
          } catch (error) {
            logger.warn("Invalid WebSocket token:", error);
          }
        }

        const context: WebSocketContext = {
          user,
          prisma,
          redis: redis,
          services,
        };

        // Only add connectionParams if it exists
        if (ctx.connectionParams !== undefined) {
          context.connectionParams = ctx.connectionParams;
        }

        return context;
      },
      onConnect: async (ctx) => {
        logger.info("WebSocket client connected", {
          connectionParams: ctx.connectionParams,
        });
      },
      onDisconnect: (ctx, code, reason) => {
        logger.info(
          `WebSocket client disconnected: ${code || "unknown"} ${
            reason || "unknown reason"
          }`
        );
      },
      onError: (ctx, id, payload, errors) => {
        logger.error("WebSocket error:", { id, payload, errors });
      },
    },
    wsServer
  );

  return serverCleanup;
}

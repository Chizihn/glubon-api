import { useServer } from "graphql-ws/use/ws";
import type { Disposable } from "graphql-ws";
import { WebSocketServer } from "ws";
import { GraphQLSchema } from "graphql";
import { Container } from "typedi";
import { WebSocketContext } from "../types";
import { prisma, redis } from "../config";
import { logger } from "../utils";
import { PresenceService } from "../services/presence";
import { AuthService } from "../services/auth";

export async function createWebSocketServer(
  wsServer: WebSocketServer,
  schema: GraphQLSchema
): Promise<Disposable> {
  const presenceService = Container.get(PresenceService);
  const authService = Container.get(AuthService);

  // Clean up stale connections periodically
  const cleanupInterval = setInterval(
    () => presenceService.cleanupStaleConnections(),
    5 * 60 * 1000 // Every 5 minutes
  );    

  const serverCleanup = useServer(
    {
      schema,
      context: async (ctx): Promise<WebSocketContext> => {
        const context: WebSocketContext = {
          prisma,
          redis,
          user: null,
        };

        try {
          const authHeader = ctx.connectionParams?.authorization;
          if (typeof authHeader === 'string') {
            const token = authHeader.replace('Bearer ', '');
            if (token) {
              const decoded = await authService.verifyToken(token);
              const user = await prisma.user.findUnique({
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
              
              if (user) {
                context.user = user;
                const socketId = (ctx.extra?.socket as any)?.id || 'unknown';
                await presenceService.userConnected(user.id, socketId);
              }
            }
          }
        } catch (error) {
          logger.warn("WebSocket authentication error:", error);
        }

        return context;
      },
      onConnect: async (ctx) => {
        logger.info("WebSocket client connected", {
          connectionParams: ctx.connectionParams,
        });
      },
      onDisconnect: async (ctx) => {
        try {
          const userId = (ctx.extra?.user as any)?.id;
          if (userId) {
            await presenceService.userDisconnected(userId);
            // logger.info(`User ${userId} disconnected from WebSocket`);
          }
        } catch (error) {
          logger.error("Error in onDisconnect:", error);
        }
      },
      onClose: async (ctx) => {
        try {
          const userId = (ctx.extra?.user as any)?.id;
          if (userId) {
            await presenceService.userDisconnected(userId);
          }
        } catch (error) {
          logger.error("Error in onClose:", error);
        }
      },
      onError: (ctx, id, payload, errors) => {
        logger.error("WebSocket error:", { id, payload, errors });
      },
    },
    wsServer
  );

  // Return cleanup function
  return {
    dispose: async () => {
      clearInterval(cleanupInterval);
      await serverCleanup.dispose();
    },
  };
}

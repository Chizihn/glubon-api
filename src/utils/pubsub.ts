import { PubSub } from "graphql-subscriptions";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { appConfig, redis } from "../config";

export const pubSub = appConfig.isProduction
  ? new RedisPubSub({
      publisher: redis,
      subscriber: redis,
    })
  : new PubSub();

export const SUBSCRIPTION_EVENTS = {
  MESSAGE_SENT: "MESSAGE_SENT",
  NOTIFICATION_CREATED: "NOTIFICATION_CREATED",
  PROPERTY_LIKED: "PROPERTY_LIKED",
  PROPERTY_VIEWED: "PROPERTY_VIEWED",
} as const;

export type SubscriptionTopic = keyof typeof SUBSCRIPTION_EVENTS;

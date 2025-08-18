import { PubSub } from "graphql-subscriptions";
import { RedisPubSub } from "graphql-redis-subscriptions";
import { appConfig, redis } from "../config";

export const pubSub = appConfig.isProduction
  ? new RedisPubSub({
      publisher: redis,
      subscriber: redis,
    })
  : new PubSub();

export const EVENTS = {
  MESSAGE_SENT: "MESSAGE_SENT",
  NOTIFICATION_CREATED: "NOTIFICATION_CREATED",
  PROPERTY_LIKED: "PROPERTY_LIKED",
  PROPERTY_VIEWED: "PROPERTY_VIEWED",
  // Presence related events
  PRESENCE_CHANGED: "PRESENCE_CHANGED",
  TYPING_STATUS: "TYPING_STATUS",
} as const;

export const SUBSCRIPTION_EVENTS = {
  MESSAGE_SENT: "MESSAGE_SENT",
  NOTIFICATION_CREATED: "NOTIFICATION_CREATED",
  PROPERTY_LIKED: "PROPERTY_LIKED",
  PROPERTY_VIEWED: "PROPERTY_VIEWED",
  // Presence related subscription events
  PRESENCE_CHANGED: "PRESENCE_CHANGED",
  TYPING_STATUS: "TYPING_STATUS",
} as const;

export type PubSubEvent = keyof typeof EVENTS;
export type SubscriptionTopic = keyof typeof SUBSCRIPTION_EVENTS;

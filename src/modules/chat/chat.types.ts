import {
  ObjectType,
  Field,
  Int,
  GraphQLISODateTime,
  registerEnumType,
} from "type-graphql";
import { MessageType, RoleEnum } from "@prisma/client";
import { User } from "../user/user.types";
import { Property } from "../property/property.types";
import { PaginationInfo } from "../../types/responses";
import { UserPresence } from "../presence/presence.types";

// Register enums for GraphQL
registerEnumType(MessageType, {
  name: "MessageType",
  description: "The type of message sent in a conversation",
});

@ObjectType()
export class Message {
  @Field(() => String)
  id: string;

  @Field(() => String)
  conversationId: string;

  @Field(() => String)
  senderId: string;

  @Field(() => String)
  content: string;

  @Field(() => MessageType)
  messageType: MessageType;

  @Field(() => [String])
  attachments: string[];

  @Field(() => Boolean)
  isRead: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => User)
  sender: User;

  @Field(() => Property, { nullable: true })
  property?: Property;
}

@ObjectType()
export class Conversation {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  propertyId?: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => [User])
  participants: User[];

  @Field(() => Message, { nullable: true })
  lastMessage?: Message;

  @Field(() => Int)
  unreadCount: number;

  @Field(() => Property, { nullable: true })
  property?: Property;
}

@ObjectType()
export class PaginatedConversations {
  @Field(() => [Conversation])
  items: Conversation[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: Conversation[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

@ObjectType()
export class PaginatedMessages {
  @Field(() => [Message])
  items: Message[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: Message[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

@ObjectType()
export class TypingStatus {
  @Field(() => String)
  conversationId: string;

  @Field(() => String)
  userId: string;

  @Field(() => User)
  user: User;

  @Field(() => Boolean)
  isTyping: boolean;

  @Field(() => GraphQLISODateTime)
  timestamp: Date;
}


@ObjectType()
export class MessageDeliveryStatus {
  @Field(() => String)
  messageId: string;

  @Field(() => String)
  userId: string;

  @Field(() => Boolean)
  delivered: boolean;

  @Field(() => Boolean)
  read: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  deliveredAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  readAt?: Date;
}

@ObjectType()
export class ConversationStats {
  @Field(() => Int)
  totalMessages: number;

  @Field(() => Int)
  unreadMessages: number;

  @Field(() => Int)
  totalParticipants: number;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastActivity?: Date;
}

// Subscription payloads
@ObjectType()
export class MessageSentPayload {
  @Field(() => Message)
  message: Message;

  @Field(() => String)
  conversationId: string;

  @Field(() => [String])
  recipientIds: string[];
}

@ObjectType()
export class ConversationUpdatedPayload {
  @Field(() => Conversation)
  conversation: Conversation;

  @Field(() => String)
  action: string; // 'created', 'updated', 'archived'
}

@ObjectType()
export class TypingStatusPayload {
  @Field(() => TypingStatus)
  typingStatus: TypingStatus;
}

@ObjectType()
export class PresenceUpdatePayload {
  @Field(() => UserPresence)
  presence: UserPresence;
}

// Response types
@ObjectType()
export class SendMessageResponse {
  @Field(() => Message)
  message: Message;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  conversationId: string;
}

@ObjectType()
export class CreateConversationResponse {
  @Field(() => Conversation)
  conversation: Conversation;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => Boolean)
  isNew: boolean; // Whether this is a newly created conversation
}

@ObjectType()
export class MarkAsReadResponse {
  @Field(() => Int)
  updatedCount: number;

  @Field(() => Boolean)
  success: boolean;
}

@ObjectType()
export class UnreadCountResponse {
  @Field(() => Int)
  totalUnread: number;

  @Field(() => [ConversationUnreadCount])
  conversationCounts: ConversationUnreadCount[];
}

@ObjectType()
export class ConversationUnreadCount {
  @Field(() => String)
  conversationId: string;

  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class BroadcastMessageResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => MessageType)
  messageType: MessageType;

  @Field(() => [RoleEnum])
  recipientRoles: RoleEnum[];

  @Field(() => [String])
  sentToUserIds: string[];

  @Field(() => Int)
  totalRecipients: number;

  @Field(() => [String])
  attachments: string[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => User, { nullable: true })
  sender: User;

  constructor(data: Partial<BroadcastMessageResponse>) {
    Object.assign(this, data);
  }
}

@ObjectType()
export class PaginatedBroadcastMessagesResponse {
  @Field(() => [BroadcastMessageResponse])
  items: BroadcastMessageResponse[];

  @Field(() => PaginationInfo)
  pagination: PaginationInfo;

  constructor(
    items: BroadcastMessageResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    this.items = items;
    this.pagination = new PaginationInfo(page, limit, totalItems);
  }
}

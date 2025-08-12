import { ObjectType, Field, Int, GraphQLISODateTime } from "type-graphql";
import { PaginatedResponse } from "../../types/responses";
import { User } from "../user/user.types";
import { MessageType } from "@prisma/client";

import { registerEnumType } from "type-graphql";
import { Property } from "../property/property.types";

registerEnumType(MessageType, {
  name: "MessageType",
  description:
    "The type of message sent in a conversation (e.g., text, image, file, etc.)",
});

@ObjectType()
export class MessageResponse {
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
}

@ObjectType()
export class ConversationResponse {
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

  @Field(() => Property, { nullable: true })
  property?: Property;

  @Field(() => [User])
  participants: User[];

  @Field(() => MessageResponse, { nullable: true })
  lastMessage?: MessageResponse;

  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class PaginatedConversationsResponse extends PaginatedResponse<ConversationResponse> {
  constructor(
    items: ConversationResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    super(items, page, limit, totalItems);
    this.items = items;
  }
}

@ObjectType()
export class PaginatedMessagesResponse extends PaginatedResponse<MessageResponse> {
  constructor(
    items: MessageResponse[],
    page: number,
    limit: number,
    totalItems: number
  ) {
    super(items, page, limit, totalItems);
    this.items = items;
  }
}

@ObjectType()
export class UnreadCountResponse {
  @Field(() => Int)
  count: number;
}

@ObjectType()
export class MarkAsReadResponse {
  @Field(() => Int)
  updatedCount: number;
}

@ObjectType()
export class MessageSentPayload {
  @Field(() => MessageResponse)
  message: MessageResponse;

  @Field(() => String)
  conversationId: string;

  @Field(() => [String])
  recipientIds: string[]; // Changed to array for potential multi-user chats
}

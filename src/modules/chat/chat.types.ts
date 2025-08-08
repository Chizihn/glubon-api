import { ObjectType, Field, Int } from "type-graphql";
import { PaginatedResponse } from "../../types/responses";
import { User } from "../user/user.types";
import { MessageType } from "@prisma/client";

import { registerEnumType } from "type-graphql";
import { PropertyResponse } from "../property/property.types";

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

  @Field(() => Date)
  createdAt: Date;

  @Field(() => User)
  sender: User;
}

@ObjectType()
export class ConversationResponse {
  @Field(() => String)
  id: string;

  @Field(() => String)
  propertyId: string;

  @Field(() => String)
  renterId: string;

  @Field(() => String)
  ownerId: string;

  @Field(() => Boolean)
  isActive: boolean;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => PropertyResponse)
  property: PropertyResponse;

  @Field(() => User)
  renter: User;

  @Field(() => User)
  owner: User;

  @Field(() => User)
  participant: User;

  @Field(() => MessageResponse, { nullable: true })
  lastMessage?: MessageResponse;

  @Field(() => Int)
  unreadCount: number;
}

@ObjectType()
export class PaginatedConversationsResponse extends PaginatedResponse<ConversationResponse> {
  // ...existing code...

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
  // ...existing code...

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

  @Field(() => String)
  recipientId: string;
}

import { MessageType } from "@prisma/client";

export interface CreateConversationInput {
  propertyId: string;
  renterId: string;
  ownerId: string;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  messageType?: MessageType;
  attachments?: string[];
}

export interface ConversationFilters {
  userId: string;
  isActive?: boolean;
  propertyId?: string;
  search?: string;
}

export interface MessageFilters {
  conversationId: string;
  messageType?: MessageType;
  fromDate?: Date;
  toDate?: Date;
}

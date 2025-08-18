import { MessageType } from "@prisma/client";

export interface CreateConversationInput {
  participantIds: string[];
  propertyId?: string;
}

export interface SendMessageInput {
  conversationId?: string;
  recipientIds?: string[];
  content: string;
  messageType?: MessageType;
  attachments?: string[];
  propertyId?: string;
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

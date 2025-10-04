//src/types/services/user.ts
import { DocumentType, User } from "@prisma/client";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  profilePic?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

import { FileUpload } from 'graphql-upload-ts';

export interface SubmitIdentityVerificationInput {
  documentType: DocumentType;
  documentNumber: string;
  documentImages: FileUpload[];
}

export interface UserWithStats extends Omit<User, "password" | "refreshToken"> {
  stats?: {
    propertiesCount: number;
    likedPropertiesCount: number;
    viewedPropertiesCount: number;
    conversationsCount: number;
  };
}

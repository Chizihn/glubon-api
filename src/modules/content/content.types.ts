import { ContentStatus, ContentType as ContentTypePrisma, DisputeStatus, DisputeType } from "@prisma/client";
import { Field, ObjectType, Int, ID, registerEnumType } from "type-graphql";


registerEnumType(ContentTypePrisma, {
  name: "ContentType",
  description: "The type of content",
});

registerEnumType(ContentStatus, {
  name: "ContentStatus",
  description: "The status of the content",
});

registerEnumType(DisputeType, {
  name: "DisputeType",
  description: "The type of content dispute",
});

registerEnumType(DisputeStatus, {
  name: "DisputeStatus",
  description: "The status of a content dispute",
});

@ObjectType()
export class ContentAuthor {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  firstName: string;

  @Field(() => String)
  lastName: string;

  @Field(() => String)
  email: string;

  @Field(() => String, { nullable: true })
  profilePic?: string;
}

@ObjectType()
export class ContentVersion {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  version: number;

  @Field(() => String)
  title: string;

  @Field(() => String)
  content: string;

  @Field(() => String, { nullable: true })
  excerpt?: string;

  @Field(() => ContentTypePrisma)
  type: ContentTypePrisma;

  @Field(() => ContentStatus)
  status: ContentStatus;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field(() => ContentAuthor, { nullable: true })
  updatedBy?: ContentAuthor;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;
}

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  contentId: string;

  @Field(() => String)
  text: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => ContentAuthor)
  user: ContentAuthor;

  @Field(() => [Comment], { nullable: true })
  replies?: Comment[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class ContentDispute {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => DisputeType)
  type: DisputeType;

  @Field(() => DisputeStatus)
  status: DisputeStatus;

  @Field(() => ID, { nullable: true })
  contentId?: string;

  @Field(() => ContentAuthor)
  reportedBy: ContentAuthor;

  @Field(() => ContentAuthor, { nullable: true })
  assignedTo?: ContentAuthor;

  @Field(() => ContentAuthor, { nullable: true })
  resolvedBy?: ContentAuthor;

  @Field(() => String, { nullable: true })
  evidence?: string;

  @Field(() => String, { nullable: true })
  resolution?: string;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}

@ObjectType()
export class Content {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  slug: string;

  @Field(() => String)
  content: string;

  @Field(() => String, { nullable: true })
  excerpt?: string;

  @Field(() => ContentTypePrisma)
  type: ContentTypePrisma;

  @Field(() => ContentStatus)
  status: ContentStatus;

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => [String])
  tags: string[];

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field(() => Boolean)
  featured: boolean;

  @Field(() => String, { nullable: true })
  featuredImage?: string;

  @Field(() => String, { nullable: true })
  featuredImageAlt?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string;

  @Field(() => String, { nullable: true })
  seoDescription?: string;

  @Field(() => [String])
  seoKeywords: string[];

  @Field(() => Boolean)
  allowComments: boolean;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Date, { nullable: true })
  publishedAt?: Date;

  @Field(() => ContentAuthor)
  author: ContentAuthor;

  @Field(() => ContentAuthor, { nullable: true })
  updatedBy?: ContentAuthor;

  @Field(() => [ContentVersion])
  versions: ContentVersion[];

  @Field(() => [Comment], { nullable: true })
  comments?: Comment[];

  @Field(() => [ContentDispute], { nullable: true })
  disputes?: ContentDispute[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date;

  @Field(() => Int)
  version: number;
}

@ObjectType()
export class ContentListResponse {
  @Field(() => [Content])
  items: Content[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentVersionHistory {
  @Field(() => [ContentVersion])
  versions: ContentVersion[];

  @Field(() => Int)
  total: number;
}

@ObjectType()
export class CommentListResponse {
  @Field(() => [Comment])
  items: Comment[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentDisputeListResponse {
  @Field(() => [ContentDispute])
  items: ContentDispute[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentStats {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  published: number;

  @Field(() => Int)
  draft: number;

  @Field(() => Int)
  archived: number;

  @Field(() => Int)
  scheduled: number;

  @Field(() => Int)
  trash: number;

  @Field(() => Int)
  pendingReview: number;

  @Field(() => Int)
  rejected: number;

  @Field(() => [Content], { nullable: true })
  recent?: Content[];

  @Field(() => [Content], { nullable: true })
  popular?: Content[];
}

@ObjectType()
export class ContentResponse {
  @Field(() => Content, { nullable: true })
  data?: Content;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class ContentListResponseData {
  @Field(() => [Content])
  items: Content[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentStatsResponse {
  @Field(() => ContentStats, { nullable: true })
  data?: ContentStats;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class ContentVersionHistoryResponse {
  @Field(() => ContentVersionHistory, { nullable: true })
  data?: ContentVersionHistory;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class CommentResponse {
  @Field(() => Comment, { nullable: true })
  data?: Comment;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class CommentListResponseData {
  @Field(() => [Comment])
  items: Comment[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentDisputeResponse {
  @Field(() => ContentDispute, { nullable: true })
  data?: ContentDispute;

  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => [String], { nullable: true })
  errors?: string[];
}

@ObjectType()
export class ContentDisputeListResponseData {
  @Field(() => [ContentDispute])
  items: ContentDispute[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Boolean)
  hasNextPage: boolean;

  @Field(() => Boolean)
  hasPreviousPage: boolean;
}

@ObjectType()
export class ContentCreatedPayload {
  @Field(() => Content)
  content: Content;

  @Field(() => String)
  userId: string;
}

@ObjectType()
export class ContentStatusChangedPayload {
  @Field(() => Content)
  content: Content;

  @Field(() => String)
  userId: string;
}
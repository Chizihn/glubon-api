import { ContentStatus, ContentType as ContentTypePrisma, DisputeStatus, DisputeType } from "@prisma/client";
import { Field, InputType, Int, ID } from "type-graphql";

@InputType()
export class ContentFilterInput {
  @Field(() => [ContentTypePrisma], { nullable: true })
  types?: ContentTypePrisma[];

  @Field(() => [ContentStatus], { nullable: true })
  statuses?: ContentStatus[];

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => String, { nullable: true })
  search?: string;

  @Field(() => Boolean, { nullable: true })
  includeArchived?: boolean;

  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;
}

@InputType()
export class CreateContentInput {
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

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => ContentStatus, { nullable: true })
  status?: ContentStatus;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field(() => String, { nullable: true })
  featuredImage?: string;

  @Field(() => String, { nullable: true })
  featuredImageAlt?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string;

  @Field(() => String, { nullable: true })
  seoDescription?: string;

  @Field(() => [String], { nullable: true })
  seoKeywords?: string[];

  @Field(() => Boolean, { nullable: true })
  allowComments?: boolean;
}

@InputType()
export class UpdateContentInput {
  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  content?: string;

  @Field(() => String, { nullable: true })
  excerpt?: string;

  @Field(() => ContentTypePrisma, { nullable: true })
  type?: ContentTypePrisma;

  @Field(() => String, { nullable: true })
  category?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => ContentStatus, { nullable: true })
  status?: ContentStatus;

  @Field(() => String, { nullable: true })
  metadata?: string;

  @Field(() => String, { nullable: true })
  featuredImage?: string;

  @Field(() => String, { nullable: true })
  featuredImageAlt?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string;

  @Field(() => String, { nullable: true })
  seoDescription?: string;

  @Field(() => [String], { nullable: true })
  seoKeywords?: string[];

  @Field(() => Boolean, { nullable: true })
  allowComments?: boolean;
}

@InputType()
export class ContentVersionInput {
  @Field(() => ID)
  contentId: string;

  @Field(() => Int)
  version: number;
}

@InputType()
export class ContentStatusInput {
  @Field(() => ID)
  contentId: string;

  @Field(() => ContentStatus)
  status: ContentStatus;

  @Field(() => String, { nullable: true })
  reason?: string;
}

@InputType()
export class CreateCommentInput {
  @Field(() => ID)
  contentId: string;

  @Field(() => String)
  text: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;
}

@InputType()
export class UpdateCommentInput {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  text: string;
}

@InputType()
export class CreateContentDisputeInput {
  @Field(() => ID)
  contentId: string;

  @Field(() => String)
  title: string;

  @Field(() => String)
  description: string;

  @Field(() => DisputeType)
  type: DisputeType;

  @Field(() => String, { nullable: true })
  evidence?: string;
}

@InputType()
export class UpdateContentDisputeInput {

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => DisputeType, { nullable: true })
  type?: DisputeType;

  @Field(() => DisputeStatus, { nullable: true })
  status?: DisputeStatus;

  @Field(() => String, { nullable: true })
  resolution?: string;

  @Field(() => String, { nullable: true })
  evidence?: string;
}
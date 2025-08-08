import { ObjectType, Field } from "type-graphql";

// Response Types
@ObjectType()
export class UploadResult {
  @Field()
  url: string;

  @Field()
  key: string;

  @Field()
  fileName: string;

  @Field()
  size: number;

  @Field()
  mimetype: string;
}

@ObjectType()
export class GenerateUploadUrlResponse {
  @Field()
  uploadUrl: string;

  @Field()
  key: string;
}

@ObjectType()
export class SignedUrlResponse {
  @Field()
  url: string;
}

@ObjectType()
export class FileMetadataResponse {
  @Field()
  contentLength: number;

  @Field()
  contentType: string;

  @Field()
  lastModified: Date;

  @Field({ nullable: true })
  etag?: string;
}

@ObjectType()
export class MultipleUploadResponse {
  @Field(() => [UploadResult])
  files: UploadResult[];

  @Field()
  message: string;
}

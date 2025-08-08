import { Field, InputType } from "type-graphql";

// Input Types
@InputType()
export class GenerateUploadUrlInput {
  @Field()
  fileName: string;

  @Field()
  contentType: string;
}

@InputType()
export class DeleteFileInput {
  @Field()
  key: string;
}

@InputType()
export class DeleteFilesInput {
  @Field(() => [String])
  keys: string[];
}

@InputType()
export class GetSignedUrlInput {
  @Field()
  key: string;

  @Field({ defaultValue: 3600 })
  expiresIn: number;
}

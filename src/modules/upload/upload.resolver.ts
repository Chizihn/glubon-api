import {
  Resolver,
  Mutation,
  Query,
  UseMiddleware,
  ObjectType,
  Field,
  InputType,
} from "type-graphql";

import {
  FileMetadataResponse,
  GenerateUploadUrlResponse,
  SignedUrlResponse,
} from "./upload.types";
import {
  DeleteFileInput,
  DeleteFilesInput,
  GenerateUploadUrlInput,
  GetSignedUrlInput,
} from "./upload.inputs";
import { UploadService } from "../../services/upload-service";
import { prisma } from "../../config";
import { AuthMiddleware } from "../../middleware";
import { BaseResponse, Context } from "../../types";

@Resolver()
export class UploadResolver {
  private uploadService: UploadService;

  constructor() {
    this.uploadService = new UploadService(prisma);
  }

  @Mutation(() => GenerateUploadUrlResponse)
  @UseMiddleware(AuthMiddleware)
  async generateUploadUrl(
    input: GenerateUploadUrlInput,
    ctx: Context
  ): Promise<GenerateUploadUrlResponse> {
    const result = await this.uploadService.generateUploadUrl(
      input.fileName,
      input.contentType
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data!;
  }

  @Query(() => SignedUrlResponse)
  @UseMiddleware(AuthMiddleware)
  async getSignedUrl(
    input: GetSignedUrlInput,
    ctx: Context
  ): Promise<SignedUrlResponse> {
    const result = await this.uploadService.getSignedUrl(
      input.key,
      input.expiresIn
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data!;
  }

  @Query(() => FileMetadataResponse)
  @UseMiddleware(AuthMiddleware)
  async getFileMetadata(
    key: string,
    ctx: Context
  ): Promise<FileMetadataResponse> {
    const result = await this.uploadService.getFileMetadata(key);
    if (!result.success) {
      throw new Error(result.message);
    }

    const metadata = result.data!;
    return {
      contentLength: metadata.ContentLength || 0,
      contentType: metadata.ContentType || "",
      lastModified: metadata.LastModified || new Date(),
      etag: metadata.ETag,
    };
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async deleteFile(
    input: DeleteFileInput,
    ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.uploadService.deleteFile(input.key);
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async deleteFiles(
    input: DeleteFilesInput,
    ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.uploadService.deleteFiles(input.keys);
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
  }
}

import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";
import { logger } from "../utils";
import { ServiceResponse } from "../types";
import { BaseService } from "./base";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

export interface FileUpload {
  file: Express.Multer.File;
  type: "image" | "video" | "document";
  category:
    | "property"
    | "livingRoom"
    | "bedroom"
    | "bathroom"
    | "ownership"
    | "plan"
    | "dimension";
}

interface S3UploadResult {
  url: string;
  key: string;
}

export class S3Service extends BaseService {
  private s3: AWS.S3;
  private readonly bucket: string;
  private readonly maxFilesPerCategory = 5;
  private readonly maxVideoSize = 50 * 1024 * 1024; // 50MB
  private readonly maxImageSize = 5 * 1024 * 1024; // 5MB
  private readonly maxDocumentSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedImageTypes = ["image/jpeg", "image/png"];
  private readonly allowedVideoTypes = ["video/mp4", "video/mpeg"];
  private readonly allowedDocumentTypes = ["application/pdf"];

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.bucket = process.env.AWS_S3_BUCKET || "";

    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      region: process.env.AWS_REGION || "us-east-1",
    });
  }

  async uploadFiles(
    files: FileUpload[],
    propertyId: string
  ): Promise<ServiceResponse<S3UploadResult[]>> {
    try {
      // Validate file counts per category
      const categoryCounts: { [key: string]: number } = {};
      for (const file of files) {
        categoryCounts[file.category] =
          (categoryCounts[file.category] || 0) + 1;
        // Only check max files for non-video categories
        const count = categoryCounts[file.category] ?? 0;
        if (file.type !== "video" && count > this.maxFilesPerCategory) {
          return this.failure(
            `Maximum ${this.maxFilesPerCategory} files allowed per category`
          );
        }
        // Only allow one video file per upload
        if (file.type === "video" && count > 1) {
          return this.failure("Only one video file allowed");
        }
      }

      const uploadPromises = files.map((file) =>
        this.uploadSingleFile(file, propertyId)
      );
      const results = await Promise.all(uploadPromises);

      // Check for any failed uploads
      const failedUploads = results.filter((r) => !r.success);
      if (failedUploads.length > 0) {
        return this.failure(
          "Some files failed to upload",
          null,
          failedUploads.map((r) => r.message)
        );
      }

      // Only include defined data
      return this.success(
        results
          .map((r) => r.data)
          .filter((d): d is S3UploadResult => d !== undefined),
        "Files uploaded successfully"
      );
    } catch (error) {
      return this.handleError(error, "uploadFiles");
    }
  }

  private async uploadSingleFile(
    file: FileUpload,
    propertyId: string
  ): Promise<ServiceResponse<S3UploadResult>> {
    try {
      // Validate file type
      if (!this.isValidFileType(file)) {
        return this.failure(`Invalid file type for ${file.category}`);
      }

      // Validate file size
      if (!this.isValidFileSize(file)) {
        return this.failure(`File size too large for ${file.category}`);
      }

      const fileExtension = extname(file.file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const key = `properties/${propertyId}/${file.category}/${fileName}`;

      const params: AWS.S3.PutObjectRequest = {
        Bucket: this.bucket,
        Key: key,
        Body: file.file.buffer,
        ContentType: file.file.mimetype,
        ACL: "public-read",
      };

      const { Location } = await this.s3.upload(params).promise();

      return this.success({ url: Location, key }, "File uploaded successfully");
    } catch (error) {
      return this.handleError(error, "uploadSingleFile");
    }
  }

  private isValidFileType(file: FileUpload): boolean {
    switch (file.type) {
      case "image":
        return this.allowedImageTypes.includes(file.file.mimetype);
      case "video":
        return this.allowedVideoTypes.includes(file.file.mimetype);
      case "document":
        return this.allowedDocumentTypes.includes(file.file.mimetype);
      default:
        return false;
    }
  }

  private isValidFileSize(file: FileUpload): boolean {
    switch (file.type) {
      case "image":
        return file.file.size <= this.maxImageSize;
      case "video":
        return file.file.size <= this.maxVideoSize;
      case "document":
        return file.file.size <= this.maxDocumentSize;
      default:
        return false;
    }
  }

  async deleteFile(key: string): Promise<ServiceResponse<null>> {
    try {
      await this.s3
        .deleteObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();
      return this.success(null, "File deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteFile");
    }
  }
}

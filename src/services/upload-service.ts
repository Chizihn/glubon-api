import type { Request, Response } from "express";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";
import { redis, s3Config, uploadConfig } from "../config";
import { BaseService } from "./base";
import { ServiceResponse } from "../types";
import { logger } from "../utils";

// Configure AWS S3Client
const s3 = new S3Client({
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
  region: s3Config.region,
});

export interface UploadResult {
  url: string;
  key: string;
  fileName: string;
  size: number;
  mimetype: string;
}

export class UploadService extends BaseService {
  private upload: multer.Multer;
  private uploadMultipleFiles: multer.Multer;

  constructor(prisma: PrismaClient) {
    super(prisma, redis);

    // Configure multer for single file upload
    this.upload = multer({
      storage: multerS3({
        s3: s3,
        bucket: s3Config.bucket,
        key: (req, file, cb) => {
          const uniqueId = crypto.randomUUID();
          const extension = path.extname(file.originalname);
          const key = `uploads/${Date.now()}-${uniqueId}${extension}`;
          cb(null, key);
        },
        metadata: (req, file, cb) => {
          cb(null, {
            originalName: file.originalname,
            uploadedBy: (req as any).user?.id || "anonymous",
            uploadedAt: new Date().toISOString(),
          });
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
      }),
      limits: {
        fileSize: uploadConfig.maxFileSize,
        files: 1,
      },
      fileFilter: this.fileFilter.bind(this),
    });

    // Configure multer for multiple file upload
    this.uploadMultipleFiles = multer({
      storage: multerS3({
        s3: s3,
        bucket: s3Config.bucket,
        key: (req, file, cb) => {
          const uniqueId = crypto.randomUUID();
          const extension = path.extname(file.originalname);
          const key = `uploads/${Date.now()}-${uniqueId}${extension}`;
          cb(null, key);
        },
        metadata: (req, file, cb) => {
          cb(null, {
            originalName: file.originalname,
            uploadedBy: (req as any).user?.id || "anonymous",
            uploadedAt: new Date().toISOString(),
          });
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
      }),
      limits: {
        fileSize: uploadConfig.maxFileSize,
        files: uploadConfig.maxFiles,
      },
      fileFilter: this.fileFilter.bind(this),
    });
  }

  private fileFilter(
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) {
    if (uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  }

  async uploadSingle(
    req: Request,
    res: Response
  ): Promise<ServiceResponse<UploadResult>> {
    return new Promise((resolve) => {
      this.upload.single("file")(req, res, (error) => {
        if (error) {
          logger.error("Single file upload error:", error);
          if (error instanceof multer.MulterError) {
            if (error.code === "LIMIT_FILE_SIZE") {
              return resolve(this.failure("File too large"));
            }
            if (error.code === "LIMIT_UNEXPECTED_FILE") {
              return resolve(this.failure("Unexpected file field"));
            }
          }
          return resolve(this.failure(error.message || "Upload failed"));
        }

        const file = req.file as any;
        if (!file) {
          return resolve(this.failure("No file provided"));
        }

        const result: UploadResult = {
          url: file.location,
          key: file.key,
          fileName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        };

        resolve(this.success(result, "File uploaded successfully"));
      });
    });
  }

  async uploadMultiple(
    req: Request,
    res: Response
  ): Promise<ServiceResponse<UploadResult[]>> {
    return new Promise((resolve) => {
      this.uploadMultipleFiles.array("files", uploadConfig.maxFiles)(
        req,
        res,
        (error) => {
          if (error) {
            logger.error("Multiple file upload error:", error);
            if (error instanceof multer.MulterError) {
              if (error.code === "LIMIT_FILE_SIZE") {
                return resolve(this.failure("One or more files are too large"));
              }
              if (error.code === "LIMIT_FILE_COUNT") {
                return resolve(
                  this.failure(
                    `Too many files. Maximum ${uploadConfig.maxFiles} files allowed`
                  )
                );
              }
            }
            return resolve(this.failure(error.message || "Upload failed"));
          }

          const files = req.files as any[];
          if (!files || files.length === 0) {
            return resolve(this.failure("No files provided"));
          }

          const results: UploadResult[] = files.map((file) => ({
            url: file.location,
            key: file.key,
            fileName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
          }));

          resolve(
            this.success(results, `${files.length} files uploaded successfully`)
          );
        }
      );
    });
  }

  async deleteFile(key: string): Promise<ServiceResponse> {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: s3Config.bucket,
          Key: key,
        })
      );

      return this.success(null, "File deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteFile");
    }
  }

  async deleteFiles(keys: string[]): Promise<ServiceResponse> {
    try {
      if (keys.length === 0) {
        return this.success(null, "No files to delete");
      }

      const command = new DeleteObjectsCommand({
        Bucket: s3Config.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
          Quiet: false,
        },
      });

      const result = await s3.send(command);

      const deletedCount = result.Deleted?.length || 0;
      const errorCount = result.Errors?.length || 0;

      if (errorCount > 0) {
        logger.warn("Some files failed to delete:", result.Errors);
        return this.failure(
          `${deletedCount} files deleted, ${errorCount} failed`
        );
      }

      return this.success(null, `${deletedCount} files deleted successfully`);
    } catch (error) {
      return this.handleError(error, "deleteFiles");
    }
  }

  async getSignedUrl(
    key: string,
    expiresIn = 3600
  ): Promise<ServiceResponse<{ url: string }>> {
    try {
      const command = new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      });

      const url = await getSignedUrl(s3, command, { expiresIn });

      return this.success({ url }, "Signed URL generated successfully");
    } catch (error) {
      return this.handleError(error, "getSignedUrl");
    }
  }

  async getFileMetadata(key: string): Promise<ServiceResponse<any>> {
    try {
      const metadata = await s3.send(
        new HeadObjectCommand({
          Bucket: s3Config.bucket,
          Key: key,
        })
      );

      return this.success(metadata, "File metadata retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getFileMetadata");
    }
  }

  async generateUploadUrl(
    fileName: string,
    contentType: string
  ): Promise<ServiceResponse<{ uploadUrl: string; key: string }>> {
    try {
      if (!uploadConfig.allowedMimeTypes.includes(contentType)) {
        return this.failure(`File type ${contentType} is not allowed`);
      }

      const uniqueId = crypto.randomUUID();
      const extension = path.extname(fileName);
      const key = `uploads/${Date.now()}-${uniqueId}${extension}`;

      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        ContentType: contentType,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

      return this.success(
        { uploadUrl, key },
        "Upload URL generated successfully"
      );
    } catch (error) {
      return this.handleError(error, "generateUploadUrl");
    }
  }
}

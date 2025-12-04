// Fixed S3Service with improved file handling and debugging
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";
import { logger } from "../utils";
import { ServiceResponse } from "../types";
import { BaseService } from "./base";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

interface FileWithOptionalStream extends Omit<Express.Multer.File, 'stream'> {
  stream?: NodeJS.ReadableStream;
  createReadStream?: () => NodeJS.ReadableStream;
}

export interface FileUpload {
  file: FileWithOptionalStream;
  type: "image" | "video" | "document";
  category: string;
}

interface S3UploadResult {
  url: string;
  key: string;
  type: 'image' | 'video' | 'document';
  category: string;
}

import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class S3Service extends BaseService {
  private s3Client: S3Client;
  private readonly bucket: string;
  private readonly maxFilesPerCategory = 5;
  private readonly maxVideoSize = 50 * 1024 * 1024; // 50MB
  private readonly maxImageSize = 5 * 1024 * 1024; // 5MB
  private readonly maxDocumentSize = 10 * 1024 * 1024; // 10MB
  private readonly allowedImageTypes = ["image/jpeg", "image/png"];
  private readonly allowedVideoTypes = ["video/mp4", "video/mpeg", "video/quicktime"];
  private readonly allowedDocumentTypes = ["application/pdf"];

  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis
  ) {
    super(prisma, redis);
    this.bucket = process.env.AWS_S3_BUCKET || "";

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async uploadFiles(
    files: FileUpload[],
    contextId: string,
    contextType: "properties" | "users" | "verification" = "properties"
  ): Promise<ServiceResponse<Array<{ url: string; key: string; type: string; category: string }>>> {
    try {
      // Enhanced validation logging
      // console.log('=== S3 Upload Debug Info ===');
      // console.log('Files array:', JSON.stringify(files, null, 2));
      // console.log('Context ID:', contextId);
      // console.log('Context Type:', contextType);
      
      if (!files || !Array.isArray(files) || files.length === 0) {
        console.log('❌ No valid files provided');
        return this.failure("No files provided for upload", []);
      }

      // Validate file counts per category with proper logic
      const categoryCounts: { [key: string]: number } = {};
      
      for (const file of files) {
        const categoryKey = `${file.category}_${file.type}`;
        categoryCounts[categoryKey] = (categoryCounts[categoryKey] || 0) + 1;
        
        const count = categoryCounts[categoryKey];
        
        // Check limits based on type and category
        if (file.type === "video" && count > 1) {
          return this.failure(
            `Only one video file allowed per category. Found ${count} files for ${file.category}`,
            []
          );
        } else if (file.type === "image" && count > this.maxFilesPerCategory) {
          return this.failure(
            `Maximum ${this.maxFilesPerCategory} ${file.type} files allowed per category. Found ${count} files for ${file.category}`,
            []
          );
        } else if (file.type === "document" && count > 1) {
          return this.failure(
            `Only one document file allowed per category. Found ${count} files for ${file.category}`,
            []
          );
        }
      }

      const results = [];
      const failedUploads = [];
      
      for (const file of files) {
        console.log('🔍 Processing file:', {
          filename: file.file?.originalname || 'unknown',
          type: file.type,
          category: file.category,
          size: file.file?.size,
          mimetype: file.file?.mimetype,
          hasBuffer: !!file.file?.buffer,
          hasStream: !!file.file?.stream,
          hasCreateReadStream: typeof file.file?.createReadStream === 'function'
        });
        
        try {
          const uploadResult = await this.uploadSingleFile(file, contextId, contextType);
          
          if (uploadResult.success && uploadResult.data) {
            const resultWithTypeAndCategory = {
              ...uploadResult.data,
              type: file.type,
              category: file.category
            };
            console.log('✅ File upload successful:', resultWithTypeAndCategory);
            results.push(resultWithTypeAndCategory);
          } else {
            console.error('❌ File upload failed:', {
              filename: file.file?.originalname || 'unknown',
              error: uploadResult.message,
              type: file.type,
              category: file.category
            });
            failedUploads.push({
              filename: file.file?.originalname || 'unknown',
              error: uploadResult.message,
              type: file.type,
              category: file.category
            });
          }
        } catch (error) {
          console.error('❌ File upload exception:', {
            filename: file.file?.originalname || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
            type: file.type,
            category: file.category
          });
          failedUploads.push({
            filename: file.file?.originalname || 'unknown',
            error: error instanceof Error ? error.message : 'Unknown error',
            type: file.type,
            category: file.category
          });
        }
      }

      if (failedUploads.length > 0) {
        const errorDetails = failedUploads.map(f => ({
          file: f.filename,
          type: f.type,
          error: f.error
        }));
        
        logger.error('File upload failures:', { failedUploads: errorDetails });
        
        return this.failure(
          `${failedUploads.length} of ${files.length} files failed to upload. Check logs for details.`,
          results,
          errorDetails
        );
      }

      console.log('🎉 Upload completed successfully:', {
        successful: results.length,
        results: results.map(r => ({
          url: r.url,
          key: r.key,
          type: r.type,
          category: r.category
        }))
      });

      return {
        success: true,
        message: "Files uploaded successfully",
        data: results
      };
    } catch (error) {
      console.error('❌ S3Service.uploadFiles error:', error);
      return this.handleError(error, "uploadFiles") as ServiceResponse<S3UploadResult[]>;
    }
  }

  async uploadSingleFile(
    file: FileUpload,
    contextId: string,
    contextType: "properties" | "users" | "verification" = "properties"
  ): Promise<ServiceResponse<S3UploadResult>> {
    const createFailureResponse = (message: string, errors: any[] = []): ServiceResponse<S3UploadResult> => {
      return {
        success: false,
        message,
        errors
      };
    };

    try {
      // Enhanced file validation
      if (!file || !file.file) {
        return createFailureResponse("Invalid file object provided");
      }

      const actualFile = file.file;
      
      // Check if we have any file data
      if (!actualFile.buffer && !actualFile.stream && typeof actualFile.createReadStream !== 'function') {
        return createFailureResponse(
          `No valid file data found. File must have buffer, stream, or createReadStream method`,
          [{
            filename: actualFile.originalname || 'unknown',
            error: 'NO_FILE_DATA',
            availableProperties: Object.keys(actualFile)
          }]
        );
      }

      // Validate file type
      if (!this.isValidFileType(file)) {
        const allowedTypes = 
          file.type === 'image' ? this.allowedImageTypes :
          file.type === 'video' ? this.allowedVideoTypes :
          this.allowedDocumentTypes;
          
        return createFailureResponse(
          `Invalid file type for ${file.category}. Received: ${actualFile.mimetype}. Allowed types: ${allowedTypes.join(', ')}`,
          [{
            filename: actualFile.originalname || 'unknown',
            type: file.type,
            mimetype: actualFile.mimetype,
            error: 'INVALID_FILE_TYPE',
            allowedTypes
          }]
        );
      }

      // Note: We cannot easily validate file size for streams without reading the whole stream first.
      // We rely on the client/nginx/graphql limits for now, or we could use a PassThrough stream to count bytes.
      // For now, we skip strict size validation for streams to prioritize memory efficiency.

      // Get file body (buffer or stream)
      let body: Buffer | NodeJS.ReadableStream;
      
      if (actualFile.buffer) {
        body = actualFile.buffer;
        console.log('📄 Using existing buffer, size:', actualFile.buffer.length);
      } else if (typeof actualFile.createReadStream === 'function') {
        body = actualFile.createReadStream();
        console.log('🌊 Using createReadStream');
      } else if (actualFile.stream) {
        body = actualFile.stream;
        console.log('🌊 Using existing stream');
      } else {
         return createFailureResponse(
            "Cannot access file data - no buffer or stream available",
            [{
              filename: actualFile.originalname || 'unknown',
              error: 'NO_ACCESS_TO_FILE_DATA',
              availableProperties: Object.keys(actualFile)
            }]
          );
      }

      const fileExtension = extname(actualFile.originalname || '');
      const fileName = `${uuidv4()}${fileExtension}`;
      const key = `${contextType}/${contextId}/${file.category}/${fileName}`;

      console.log('☁️ Uploading to S3 (Streaming):', { 
        key,
        type: actualFile.mimetype,
        category: file.category
      });

      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: body as any,
          ContentType: actualFile.mimetype || 'application/octet-stream',
        },
      });

      const uploadResult = await upload.done();
      
      return this.success(
        {
          url: uploadResult.Location || `https://${this.bucket}.s3.amazonaws.com/${key}`,
          key: uploadResult.Key || key,
          type: file.type,
          category: file.category
        },
        "File uploaded successfully"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ S3 upload error:', errorMessage);
      
      return createFailureResponse(
        `Failed to upload file: ${errorMessage}`,
        [{
          filename: file.file?.originalname || 'unknown',
          type: file.type,
          size: file.file?.size || 0,
          mimetype: file.file?.mimetype || 'unknown',
          error: 'UPLOAD_FAILED',
          details: errorMessage
        }]
      );
    }
  }

  private isValidFileType(file: FileUpload): boolean {
    if (!file.file?.mimetype) return false;
    
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
    const size = file.file?.size || 0;
    
    switch (file.type) {
      case "image":
        return size <= this.maxImageSize;
      case "video":
        return size <= this.maxVideoSize;
      case "document":
        return size <= this.maxDocumentSize;
      default:
        return false;
    }
  }

  private determineFileType(file: any): "image" | "video" | "document" {
    const mimetype = file.mimetype || '';
    
    if (mimetype.startsWith('image/')) {
      return 'image';
    } else if (mimetype.startsWith('video/')) {
      return 'video';
    } else if (mimetype === 'application/pdf') {
      return 'document';
    }
    
    // Fallback based on filename extension
    const filename = file.originalname || file.filename || '';
    const ext = extname(filename).toLowerCase();
    
    if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      return 'image';
    } else if (['.mp4', '.mpeg', '.mov'].includes(ext)) {
      return 'video';
    } else if (ext === '.pdf') {
      return 'document';
    }
    
    return 'document'; // default fallback
  }

  async mapGraphQLFilesToS3Files(files: any[]): Promise<FileUpload[]> {
    const mappedFiles: FileUpload[] = [];
    
    if (!files || !Array.isArray(files)) {
      console.error('❌ Invalid files array:', typeof files, files);
      throw new Error('No files provided or invalid files array');
    }
  
    console.log(`🔄 S3 MAPPING: Processing ${files.length} files...`);
    
    for (let i = 0; i < files.length; i++) {
      let fileObj = files[i];
      console.log(`📁 Processing file ${i + 1}/${files.length}`);
      
      try {
        // Handle Promise resolution
        if (fileObj && typeof fileObj.then === 'function') {
          console.log('⏳ Resolving file promise...');
          fileObj = await fileObj;
          console.log('✅ Promise resolved');
        }
  
        if (!fileObj) {
          console.error('❌ File object is null/undefined at index', i);
          throw new Error(`File object is null at index ${i}`);
        }
  
        console.log('🔍 File object structure:', {
          keys: Object.keys(fileObj),
          hasFile: !!fileObj.file,
          filename: fileObj.filename || fileObj.originalname,
          mimetype: fileObj.mimetype
        });
  
        // Get the actual file data - handle different GraphQL upload formats
        let actualFile = fileObj;
        
        // If the file is nested in a 'file' property
        if (fileObj.file) {
          actualFile = fileObj.file;
        }
        
        // Validate required properties
        const filename = actualFile.filename || actualFile.originalname;
        if (!filename) {
          console.error('❌ Missing filename:', actualFile);
          throw new Error(`File at index ${i} is missing filename`);
        }
        
        // Handle mimetype
        let mimetype = actualFile.mimetype;
        if (!mimetype) {
          const ext = extname(filename).toLowerCase();
          if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            mimetype = `image/${ext.substring(1)}`;
          } else if (['.mp4', '.mov', '.mpeg'].includes(ext)) {
            mimetype = `video/${ext.substring(1)}`;
          } else if (ext === '.pdf') {
            mimetype = 'application/pdf';
          } else {
            mimetype = 'application/octet-stream';
          }
          console.log(`ℹ️ Guessed mimetype: ${mimetype} from extension: ${ext}`);
        }
        
        // Determine file type and category
        const fileType = this.determineFileType({ ...actualFile, mimetype });
        const category = fileObj.category || fileObj.fieldname || 'images'; // Default to 'images'
        
        console.log(`✅ File validated:`, {
          filename,
          type: fileType,
          category,
          size: actualFile.size || 'unknown',
          mimetype,
          hasBuffer: !!actualFile.buffer,
          hasCreateReadStream: typeof actualFile.createReadStream === 'function',
          hasStream: !!actualFile.stream
        });
        
        // Prepare the file object for S3
        const fileForS3: any = {
          originalname: filename,
          mimetype,
          size: actualFile.size || 0,
          encoding: actualFile.encoding || '7bit',
          fieldname: category,
          filename: filename,
          destination: '',
          path: '',
        };
        
        // Handle file buffer/stream
        if (actualFile.buffer) {
          fileForS3.buffer = actualFile.buffer;
          fileForS3.size = actualFile.buffer.length;
        } else if (typeof actualFile.createReadStream === 'function') {
          fileForS3.createReadStream = actualFile.createReadStream.bind(actualFile);
          // Convert stream to buffer immediately for reliability
          try {
            const stream = actualFile.createReadStream();
            const buffer = await this.streamToBuffer(stream);
            fileForS3.buffer = buffer;
            fileForS3.size = buffer.length;
            console.log('✅ Converted stream to buffer, size:', buffer.length);
          } catch (streamError) {
            console.error('❌ Stream conversion failed:', streamError);
            throw new Error(`Failed to convert stream to buffer: ${streamError}`);
          }
        } else if (actualFile.stream) {
          try {
            const buffer = await this.streamToBuffer(actualFile.stream);
            fileForS3.buffer = buffer;
            fileForS3.size = buffer.length;
            // console.log('✅ Converted stream to buffer, size:', buffer.length);
          } catch (streamError) {
            console.error('❌ Stream conversion failed:', streamError);
            throw new Error(`Failed to convert stream to buffer: ${streamError}`);
          }
        } else {
          console.error('❌ No file data available:', {
            hasBuffer: !!actualFile.buffer,
            hasStream: !!actualFile.stream,
            hasCreateReadStream: typeof actualFile.createReadStream === 'function',
            keys: Object.keys(actualFile)
          });
          throw new Error(`No file data available for file: ${filename}`);
        }
        
        const mappedFile: FileUpload = {
          file: fileForS3,
          type: fileType,
          category: category,
        };
        
        mappedFiles.push(mappedFile);
        // console.log(`✅ Successfully mapped file ${i + 1}/${files.length}: ${filename}`);
        
      } catch (error) {
        console.error(`❌ Error processing file ${i + 1}:`, error);
        throw new Error(`Failed to process file at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // console.log(`🎉 S3 MAPPING: Successfully mapped ${mappedFiles.length} files`);
    return mappedFiles;
  }
  
  // 4. IMPROVED STREAM TO BUFFER CONVERSION
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    // console.log('🔄 Converting stream to buffer...');
    
    // Handle already converted buffers
    if (Buffer.isBuffer(stream)) {
      // console.log('✅ Input is already a buffer');
      return stream;
    }
  
    // Handle buffer property
    if ((stream as any).buffer && Buffer.isBuffer((stream as any).buffer)) {
      // console.log('✅ Found buffer property');
      return (stream as any).buffer;
    }
  
    // Handle non-stream inputs
    if (typeof stream !== 'object' || typeof stream.on !== 'function') {
      // console.log('ℹ️ Converting non-stream to buffer');
      return Buffer.from(stream as any);
    }
  
    // Convert actual stream to buffer
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      
      const timeout = setTimeout(() => {
        reject(new Error('Stream conversion timeout after 30 seconds'));
      }, 30000);
      
      stream.on('data', (chunk) => {
        const buffer = Buffer.from(chunk);
        chunks.push(buffer);
        totalSize += buffer.length;
        // console.log(`📦 Received chunk: ${buffer.length} bytes, total: ${totalSize}`);
      });
      
      stream.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Stream error:', error);
        reject(error);
      });
      
      stream.on('end', () => {
        clearTimeout(timeout);
        try {
          const result = Buffer.concat(chunks);
          // console.log(`✅ Stream conversion complete: ${result.length} bytes`);
          resolve(result);
        } catch (error) {
          console.error('❌ Buffer concat error:', error);
          reject(error);
        }
      });
      
      // Handle streams that might not emit 'end'
      stream.on('close', () => {
        clearTimeout(timeout);
        if (chunks.length > 0) {
          try {
            const result = Buffer.concat(chunks);
            // console.log(`✅ Stream closed, buffer created: ${result.length} bytes`);
            resolve(result);
          } catch (error) {
            console.error('❌ Buffer concat error on close:', error);
            reject(error);
          }
        }
      });
    });
  }

  async deleteFile(key: string): Promise<ServiceResponse<null>> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return this.success(null, "File deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteFile");
    }
  }

  async deleteFiles(keys: string[]): Promise<ServiceResponse<null>> {
    if (!keys.length) {
      return this.success(null, "No files to delete");
    }

    try {
      // S3 deleteObjects can handle up to 1000 objects at once
      const chunks = [];
      for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(keys.slice(i, i + 1000));
      }

      for (const chunk of chunks) {
        const objects = chunk.map((key) => ({ Key: key }));
        await this.s3Client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: objects,
              Quiet: true,
            },
          })
        );
      }

      return this.success(null, "Files deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteFiles");
    }
  }
}
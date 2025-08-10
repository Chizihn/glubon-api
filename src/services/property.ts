import {
  PrismaClient,
  Property,
  PropertyStatus,
  RoleEnum,
  User,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
import { logger } from "../utils";
import {
  CreatePropertyInput,
  PropertyFilters,
  PropertySearchOptions,
  PropertyWithDetails,
  UpdatePropertyInput,
} from "../types/services/properties";
import { PropertyRepository } from "../repository/properties";
import { FileUpload } from "./s3";
import { S3Service } from "./s3";

export class PropertyService extends BaseService {
  private repository: PropertyRepository;
  private s3Service: S3Service;

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
    this.repository = new PropertyRepository(prisma, redis);
    this.s3Service = new S3Service(prisma, redis);
  }

  async createProperty(
    ownerId: string,
    input: CreatePropertyInput,
    files?: any[]
  ): Promise<IBaseResponse<Property>> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });

      if (!user || user.role !== RoleEnum.PROPERTY_OWNER) {
        return this.failure("Only property owners can create properties");
      }

      let s3UploadResult: any = {};
      if (files && files.length > 0) {
        const mappedFiles = await this.mapGraphQLFilesToS3Files(files);
        const uploadRes = await this.s3Service.uploadFiles(
          mappedFiles,
          ownerId,
          "properties"
        );
        if (!uploadRes.success || !uploadRes.data) {
          return this.failure(uploadRes.message);
        }
        s3UploadResult = this.organizeS3Uploads(uploadRes.data);
      }

      const coordinates = await this.getCoordinatesFromAddress(
        `${input.address}, ${input.city}, ${input.state}, Nigeria`
      );

      const property = await this.repository.create({
        ...input,
        ...s3UploadResult,
        description: input.description ?? null,
        sqft: input.sqft ?? null,
        visitingDays: input.visitingDays ?? [],
        visitingTimeStart: input.visitingTimeStart ?? null,
        visitingTimeEnd: input.visitingTimeEnd ?? null,
        ownerId,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        country: "Nigeria",
        status: PropertyStatus.DRAFT,
      });

      return this.success(property, "Property created successfully");
    } catch (error) {
      return this.handleError(error, "createProperty");
    }
  }

  async updateProperty(
    id: string,
    ownerId: string,
    input: UpdatePropertyInput,
    files?: any[]
  ): Promise<IBaseResponse<Property>> {
    try {
      let coordinates;
      let s3UploadResult: any = {};
      if (input.address || input.city || input.state) {
        const existingProperty = await this.prisma.property.findFirst({
          where: { id, ownerId },
        });
        if (!existingProperty) {
          return this.failure("Property not found or access denied");
        }
        const address = `${input.address || existingProperty.address}, ${
          input.city || existingProperty.city
        }, ${input.state || existingProperty.state}, Nigeria`;
        coordinates = await this.getCoordinatesFromAddress(address);
      }

      if (files && files.length > 0) {
        const mappedFiles = await this.mapGraphQLFilesToS3Files(files);
        const uploadRes = await this.s3Service.uploadFiles(
          mappedFiles,
          id,
          "properties"
        );
        if (!uploadRes.success || !uploadRes.data) {
          return this.failure(uploadRes.message);
        }
        s3UploadResult = this.organizeS3Uploads(uploadRes.data);
      }

      const updateData: any = {
        ...input,
        ...s3UploadResult,
        description: input.description ?? null,
        sqft: input.sqft ?? null,
        visitingTimeStart: input.visitingTimeStart ?? null,
        visitingTimeEnd: input.visitingTimeEnd ?? null,
      };

      if (coordinates) {
        updateData.latitude = coordinates.latitude ?? null;
        updateData.longitude = coordinates.longitude ?? null;
      }

      const updatedProperty = await this.repository.update(
        id,
        ownerId,
        updateData
      );
      return this.success(updatedProperty, "Property updated successfully");
    } catch (error) {
      return this.handleError(error, "updateProperty");
    }
  }

  private async mapGraphQLFilesToS3Files(
    files: FileUpload[]
  ): Promise<FileUpload[]> {
    return Promise.all(
      files.map(async (file: any) => {
        const { createReadStream, filename, mimetype, encoding } = await file;
        const stream = createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        return {
          file: {
            fieldname: "file",
            originalname: filename,
            encoding,
            mimetype,
            size: buffer.length,
            buffer,
            stream,
            destination: "",
            filename: filename,
            path: "",
          },
          type: this.getFileType(mimetype),
          category: this.getFileCategory(filename),
        };
      })
    );
  }

  private getFileType(mimetype: string): "image" | "video" | "document" {
    if (mimetype.startsWith("image/")) return "image";
    if (mimetype.startsWith("video/")) return "video";
    if (mimetype === "application/pdf") return "document";
    throw new Error("Invalid file type");
  }

  private getFileCategory(
    filename: string
  ):
    | "property"
    | "livingRoom"
    | "bedroom"
    | "bathroom"
    | "ownership"
    | "plan"
    | "dimension" {
    if (filename.includes("living")) return "livingRoom";
    if (filename.includes("bedroom")) return "bedroom";
    if (filename.includes("bathroom")) return "bathroom";
    if (filename.includes("ownership")) return "ownership";
    if (filename.includes("plan")) return "plan";
    if (filename.includes("dimension")) return "dimension";
    return "property";
  }

  private organizeS3Uploads(
    uploadResults: { url: string; key: string }[]
  ): any {
    const result: any = {};
    for (const upload of uploadResults) {
      const parts = upload.key.split("/");
      const category = parts[parts.length - 2];
      switch (category) {
        case "property":
          result.images = result.images || [];
          result.images.push(upload.url);
          break;
        case "livingRoom":
          result.livingRoomImages = result.livingRoomImages || [];
          result.livingRoomImages.push(upload.url);
          break;
        case "bedroom":
          result.bedroomImages = result.bedroomImages || [];
          result.bedroomImages.push(upload.url);
          break;
        case "bathroom":
          result.bathroomImages = result.bathroomImages || [];
          result.bathroomImages.push(upload.url);
          break;
        case "ownership":
          result.propertyOwnershipDocs = result.propertyOwnershipDocs || [];
          result.propertyOwnershipDocs.push(upload.url);
          break;
        case "plan":
          result.propertyPlanDocs = result.propertyPlanDocs || [];
          result.propertyPlanDocs.push(upload.url);
          break;
        case "dimension":
          result.propertyDimensionDocs = result.propertyDimensionDocs || [];
          result.propertyDimensionDocs.push(upload.url);
          break;
      }
    }
    return result;
  }

  async getProperties(
    filters: PropertyFilters = {},
    options: PropertySearchOptions = {},
    userId?: string
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } = await this.repository.findMany(
        filters,
        options,
        userId
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getProperties");
    }
  }

  async getPropertyById(
    id: string,
    user?: User
  ): Promise<IBaseResponse<PropertyWithDetails>> {
    try {
      logger.info(
        `Service: Getting property ${id} for user ${
          user?.id || "anonymous"
        } with role ${user?.role || "none"}`
      );

      const property = await this.repository.findById(id, user);
      if (!property) {
        logger.info(`Service: Property ${id} not found`);
        return this.failure("Property not found");
      }

      logger.info(`Service: Property ${id} retrieved successfully`);
      return this.success(property, "Property retrieved successfully");
    } catch (error) {
      logger.error(`Service: Error getting property ${id}:`, error);
      return this.handleError(error, "getPropertyById");
    }
  }

  async getMyProperties(
    ownerId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } = await this.repository.findByOwner(
        ownerId,
        options
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getMyProperties");
    }
  }

  async togglePropertyLike(
    propertyId: string,
    userId: string
  ): Promise<IBaseResponse<{ isLiked: boolean }>> {
    try {
      const isLiked = await this.repository.toggleLike(propertyId, userId);
      return this.success(
        { isLiked },
        isLiked
          ? "Property liked successfully"
          : "Property unliked successfully"
      );
    } catch (error) {
      return this.handleError(error, "togglePropertyLike");
    }
  }

  async getLikedProperties(
    userId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{
      properties: PropertyWithDetails[];
      totalCount: number;
      pagination: any;
    }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { properties, totalCount } =
        await this.repository.findLikedProperties(userId, options);
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { properties, totalCount, pagination },
        "Liked properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getLikedProperties");
    }
  }

  async getPropertyVisitors(
    propertyId: string,
    ownerId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{ visitors: any[]; totalCount: number; pagination: any }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { visitors, totalCount } = await this.repository.findVisitors(
        propertyId,
        ownerId,
        options
      );
      const pagination = this.repository.buildPagination(
        page,
        limit,
        totalCount
      );

      return this.success(
        { visitors, totalCount, pagination },
        "Property visitors retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getPropertyVisitors");
    }
  }

  async deleteProperty(
    id: string,
    ownerId: string
  ): Promise<IBaseResponse<null>> {
    try {
      const property = await this.repository.findById(id);
      if (!property) {
        return this.failure("Property not found");
      }

      const allKeys: string[] = [];
      const addKeys = (arr?: string[]) => {
        if (arr) allKeys.push(...arr);
      };
      addKeys(property.images);
      addKeys(property.livingRoomImages);
      addKeys(property.bedroomImages);
      addKeys(property.bathroomImages);
      addKeys(property.propertyOwnershipDocs);
      addKeys(property.propertyPlanDocs);
      addKeys(property.propertyDimensionDocs);
      if (property.video) allKeys.push(property.video);

      for (const urlOrKey of allKeys) {
        let key = urlOrKey;
        if (urlOrKey.startsWith("http")) {
          const url = new URL(urlOrKey);
          key = url.pathname.startsWith("/")
            ? url.pathname.slice(1)
            : url.pathname;
        }
        await this.s3Service.deleteFile(key);
      }

      await this.repository.delete(id, ownerId);
      return this.success(null, "Property deleted successfully");
    } catch (error) {
      return this.handleError(error, "deleteProperty");
    }
  }

  async getPropertyStats(): Promise<
    IBaseResponse<{
      totalProperties: number;
      activeProperties: number;
      averagePrice: number;
      totalViews: number;
      totalLikes: number;
    }>
  > {
    try {
      const stats = await this.repository.getStats();
      return this.success(stats, "Property stats retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getPropertyStats");
    }
  }

  async getTrendingProperties(
    limit: number = 10,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findTrending(limit, userId);
      return this.success(
        properties,
        "Trending properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getTrendingProperties");
    }
  }

  async getFeaturedProperties(
    limit: number = 10,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findFeatured(limit, userId);
      return this.success(
        properties,
        "Featured properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getFeaturedProperties");
    }
  }

  async getSimilarProperties(
    propertyId: string,
    limit: number = 5,
    userId?: string
  ): Promise<IBaseResponse<PropertyWithDetails[]>> {
    try {
      const properties = await this.repository.findSimilar(
        propertyId,
        limit,
        userId
      );
      return this.success(
        properties,
        "Similar properties retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getSimilarProperties");
    }
  }

  private async getCoordinatesFromAddress(
    address: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      logger.info(`Geocoding address: ${address}`);
      return null; // Placeholder for geocoding logic
    } catch (error) {
      logger.warn("Failed to geocode address:", error);
      return null;
    }
  }
}

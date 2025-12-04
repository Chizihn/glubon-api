//src/services/property.ts
import {
  Prisma,
  PrismaClient,
  Property,
  PropertyStatus,
  User,
  RoleEnum,
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
// import { Container } from "../container";
import { FileUpload, S3Service } from "./s3";
import { MapSearchResponse, MapSearchResult } from "../types/services/map";
import { PropertyUnitValidator } from "../utils/property-unit-validator";
import { PropertyRepository } from "../repository/properties";
import { UnitRepository } from "../repository/units";
import { Decimal } from "@prisma/client/runtime/library";
import { Service, Inject } from "typedi";
import { PRISMA_TOKEN, REDIS_TOKEN } from "../types/di-tokens";

@Service()
export class PropertyService extends BaseService {
  constructor(
    @Inject(PRISMA_TOKEN) prisma: PrismaClient,
    @Inject(REDIS_TOKEN) redis: Redis,
    private repository: PropertyRepository,
    private unitRepository: UnitRepository,
    private s3Service: S3Service,
    private validator: PropertyUnitValidator
  ) {
    super(prisma, redis);
  }

  async createProperty(
    ownerId: string,
    input: CreatePropertyInput,
    files?: any[]
  ): Promise<IBaseResponse<Property>> {
    try {
      // console.log('🏠 PROPERTY SERVICE: createProperty started');
      // console.log('Files received:', files?.length || 0);
      
      const user = await this.prisma.user.findUnique({
        where: { id: ownerId },
      });
  
      if (!user || user.role !== RoleEnum.LISTER) {
        return this.failure("Only property owners can create properties");
      }
  
      // Validate property and unit configuration
      const validation = await this.validator.validatePropertyCreation(input);
      if (!validation.isValid) {
        return this.failure(
          `Validation failed: ${validation.errors.join(", ")}`
        );
      }
  
      let s3UploadResult: any = {};
      
      // Process file uploads concurrently
      if (files && files.length > 0) {
        try {
          // Resolve all file promises in parallel
          const resolvedFiles = await Promise.all(
            files.map(file => file instanceof Promise ? file : Promise.resolve(file))
          );

          // Process files in parallel for better performance
          const uploadPromises = resolvedFiles.map(async (file) => {
            try {
              const mappedFiles = await this.s3Service.mapGraphQLFilesToS3Files([file]);
              if (!mappedFiles.length) {
                const filename = file.filename || 'unknown';
                logger.warn('No files to upload after mapping', { filename });
                return null;
              }
              
              const uploadRes = await this.s3Service.uploadFiles(
                mappedFiles,
                ownerId,
                'properties'
              );
              
              if (!uploadRes.success) {
                const filename = file.filename || 'unknown';
                logger.error('File upload failed', { 
                  error: uploadRes.message, 
                  errors: uploadRes.errors,
                  filename
                });
                return null;
              }
              
              return uploadRes.data?.[0] || null;
            } catch (error) {
              const filename = file.filename || 'unknown';
              logger.error('Error processing file upload', { 
                error: error instanceof Error ? error.message : 'Unknown error',
                filename
              });
              return null;
            }
          });

          // Wait for all uploads to complete
          const uploadResults = await Promise.all(uploadPromises);
          
          // Filter out failed uploads and ensure type safety
          const successfulUploads = uploadResults.filter((upload): upload is { 
            url: string; 
            key: string; 
            type: string; 
            category: string; 
          } => upload !== null);
          
          if (successfulUploads.length === 0) {
            logger.error('All file uploads failed');
            return this.failure('Failed to upload any files');
          }
          
          // Log summary of uploads
          if (successfulUploads.length < uploadResults.length) {
            logger.warn('Some files failed to upload', {
              total: uploadResults.length,
              successful: successfulUploads.length,
              failed: uploadResults.length - successfulUploads.length
            });
          } else {
            logger.info('All files uploaded successfully', {
              count: successfulUploads.length
            });
          }
          
          // Organize the successful uploads
          s3UploadResult = this.organizeS3Uploads(successfulUploads);
          logger.debug('Organized S3 uploads', { 
            categories: Object.keys(s3UploadResult) 
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('File processing error', { 
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
          });
          return this.failure(`File processing failed: ${errorMessage}`);
        }
      } else {
        logger.debug('No files to process for property creation');
      }
  
      const coordinates = await this.getCoordinatesFromAddress(
        `${input.address}, ${input.city}, ${input.state}, Nigeria`
      );
  
      // Continue with property creation...
      const result = await this.prisma.$transaction(async (tx) => {
        const property = await this.repository.create(
          {
            ...input,
            ...s3UploadResult,
            description: input.description ?? null,
            sqft: input.sqft ?? null,
            visitingDays: input.visitingDays ?? [],
            visitingTimeStart: input.visitingTimeStart ?? null,
            visitingTimeEnd: input.visitingTimeEnd ?? null,
            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,
            country: "Nigeria",
            status: PropertyStatus.PENDING_REVIEW,
            isStandalone: (input as any).isStandalone ?? false,
            totalUnits: 0,
            availableUnits: 0,
            owner: {
              connect: { id: ownerId },
            },
          },
          tx
        );
  
        // Handle unit creation logic...
        const inputWithUnits = input as any;
  
        if (inputWithUnits.units && inputWithUnits.units.length > 0) {
          for (const unitInput of inputWithUnits.units) {
            await this.unitRepository.create(
              {
                ...unitInput,
                propertyId: property.id,
              },
              tx
            );
          }
        } else if (inputWithUnits.isStandalone) {
          await this.unitRepository.create(
            {
              propertyId: property.id,
              title: input.title || null,
              description: input.description || null,
              amount: input.amount,
              rentalPeriod: input.rentalPeriod,
              sqft: input.sqft || null,
              bedrooms: input.bedrooms || null,
              bathrooms: input.bathrooms || null,
              roomType: input.roomType,
              amenities: input.amenities,
              isFurnished: input.isFurnished,
              isForStudents: input.isForStudents,
            },
            tx
          );
        } else if (inputWithUnits.bulkUnits) {
          const { unitTitle, unitCount, unitDetails } = inputWithUnits.bulkUnits;
          for (let i = 1; i <= unitCount; i++) {
            await this.unitRepository.create(
              {
                propertyId: property.id,
                title: `${unitTitle} ${i}`,
                description: unitDetails.description || `${unitTitle} ${i}`,
                amount: unitDetails.amount || input.amount,
                rentalPeriod: unitDetails.rentalPeriod || input.rentalPeriod,
                sqft: unitDetails.sqft || input.sqft,
                bedrooms: unitDetails.bedrooms || input.bedrooms,
                bathrooms: unitDetails.bathrooms || input.bathrooms,
                roomType: unitDetails.roomType || input.roomType,
                amenities: unitDetails.amenities || input.amenities,
                isFurnished: unitDetails.isFurnished ?? input.isFurnished,
                isForStudents: unitDetails.isForStudents ?? input.isForStudents,
              },
              tx
            );
          }
        }
  
        return property;
      });
  
      // Invalidate cache to show new property immediately
      await Promise.all([
        // Invalidate owner's properties list
        this.deleteCachePattern(`properties:owner:${ownerId}*`),
        // Invalidate general listings
        this.deleteCachePattern(`properties:list*`),
        // Invalidate search caches
        this.deleteCachePattern(`properties:search*`),
      ]);

      console.log('✅ PROPERTY SERVICE: Property created successfully');
      return this.success(result, "Property created successfully");
      
    } catch (error) {
      console.error('❌ PROPERTY SERVICE: Error in createProperty:', error);
      return this.handleError(error, "createProperty");
    }
  }
  
  async updateProperty(
    id: string,
    ownerId: string,
    input: UpdatePropertyInput,
    files?: any[]
  ): Promise<IBaseResponse<Property>> {
    console.log('🔄 PROPERTY SERVICE: updateProperty started');
    
    try {
      let coordinates;
      let s3UploadResult: any = {};
      
      // Get existing property for reference
      const existingProperty = await this.prisma.property.findFirst({
        where: { id, ownerId },
      });
      
      if (!existingProperty) {
        console.error('❌ Property not found or access denied');
        return this.failure("Property not found or access denied");
      }
      
      // Update coordinates if address changed
      if (input.address || input.city || input.state) {
        const address = `${input.address || existingProperty.address}, ${
          input.city || existingProperty.city
        }, ${input.state || existingProperty.state}, Nigeria`;
        coordinates = await this.getCoordinatesFromAddress(address);
      }
  
      // Handle file uploads if any
      if (files && files.length > 0) {
        console.log('📁 PROPERTY SERVICE: Processing files for update...');
        console.log('Raw files structure:', JSON.stringify(files.map(f => ({
          keys: Object.keys(f || {}),
          isPromise: f instanceof Promise,
          hasFile: !!f?.file,
          filename: f?.filename || f?.originalname || f?.file?.filename || f?.file?.originalname
        })), null, 2));
        
        try {
          // Wait for all promises to resolve first
          const resolvedFiles = await Promise.all(files.map(async (file) => {
            if (file instanceof Promise) {
              console.log('⏳ Resolving file promise for update...');
              return await file;
            }
            return file;
          }));
          
          console.log('✅ All file promises resolved for update');
          
          // Map the resolved files
          const mappedFiles = await this.s3Service.mapGraphQLFilesToS3Files(resolvedFiles);
          console.log('✅ Files mapped for update:', mappedFiles.length);
          
          const uploadRes = await this.s3Service.uploadFiles(
            mappedFiles,
            id,
            "properties"
          );
          
          if (!uploadRes.success) {
            console.error('❌ S3 update upload failed:', uploadRes.message);
            console.error('Upload errors:', uploadRes.errors);
            return this.failure(`File upload failed: ${uploadRes.message}`);
          }
          
          if (!uploadRes.data || uploadRes.data.length === 0) {
            console.error('❌ No upload data returned for update');
            return this.failure('File upload completed but no data returned');
          }
          
          console.log('✅ S3 upload successful for update:', uploadRes.data.length, 'files');
          s3UploadResult = this.organizeS3Uploads(uploadRes.data);
          console.log('📦 Organized S3 results for update:', Object.keys(s3UploadResult));
          
        } catch (fileError) {
          console.error('❌ File processing error during update:', fileError);
          return this.failure(`File upload failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
        }
      } else {
        console.log('ℹ️ No files to process for update');
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
  
      // Use transaction to update property and handle unit updates
      const result = await this.prisma.$transaction(async (tx) => {
        const updatedProperty = await this.repository.update(
          id,
          ownerId,
          updateData,
          tx
        );
  
        // Handle unit updates if provided
        const inputWithUnits = input as any;
  
        if (inputWithUnits.units && inputWithUnits.units.length > 0) {
          // Update existing units or create new ones
          for (const unitInput of inputWithUnits.units) {
            if (unitInput.id) {
              // Update existing unit
              await this.unitRepository.update(unitInput.id, id, unitInput, tx);
            } else {
              // Create new unit
              await this.unitRepository.create(
                {
                  ...unitInput,
                  propertyId: id,
                },
                tx
              );
            }
          }
        }
  
        if (inputWithUnits.bulkUnits) {
          // Handle bulk unit updates/creation
          const { unitTitle, unitCount, unitDetails } = inputWithUnits.bulkUnits;
  
          // Get existing units for this property
          const existingUnits = await tx.unit.findMany({
            where: { propertyId: id },
            orderBy: { createdAt: "asc" },
          });
  
          // Update existing units up to the count
          for (let i = 0; i < Math.min(unitCount, existingUnits.length); i++) {
            const unit = existingUnits[i];
            if (unit) {
              await this.unitRepository.update(
                unit.id,
                id,
                {
                  title: `${unitTitle} ${i + 1}`,
                  description: unitDetails.description || `${unitTitle} ${i + 1}`,
                  amount: unitDetails.amount,
                  rentalPeriod: unitDetails.rentalPeriod,
                  sqft: unitDetails.sqft,
                  bedrooms: unitDetails.bedrooms,
                  bathrooms: unitDetails.bathrooms,
                  roomType: unitDetails.roomType,
                  amenities: unitDetails.amenities,
                  isFurnished: unitDetails.isFurnished,
                  isForStudents: unitDetails.isForStudents,
                },
                tx
              );
            }
          }
  
          // Create additional units if needed
          for (let i = existingUnits.length; i < unitCount; i++) {
            await this.unitRepository.create(
              {
                propertyId: id,
                title: `${unitTitle} ${i + 1}`,
                description: unitDetails.description || `${unitTitle} ${i + 1}`,
                amount:
                  unitDetails.amount ||
                  updatedProperty?.amount ||
                  new Decimal(0),
                rentalPeriod:
                  unitDetails.rentalPeriod || updatedProperty.rentalPeriod,
                sqft: unitDetails.sqft || updatedProperty.sqft,
                bedrooms: unitDetails.bedrooms || updatedProperty.bedrooms,
                bathrooms: unitDetails.bathrooms || updatedProperty.bathrooms,
                roomType: unitDetails.roomType || updatedProperty.roomType,
                amenities: unitDetails.amenities || updatedProperty.amenities,
                isFurnished:
                  unitDetails.isFurnished ?? updatedProperty.isFurnished,
                isForStudents:
                  unitDetails.isForStudents ?? updatedProperty.isForStudents,
              },
              tx
            );
          }
  
          // Remove excess units if count is reduced (only if they're not rented)
          if (unitCount < existingUnits.length) {
            const unitsToRemove = existingUnits.slice(unitCount);
            for (const unit of unitsToRemove) {
              if (unit.status !== "RENTED") {
                await this.unitRepository.delete(unit.id, id, tx);
              }
            }
          }
        }
  
        return updatedProperty;
      });
  
      // Invalidate cache after successful update
      await Promise.all([
       // Invalidate specific property cache
        this.deleteCachePattern(`property:${id}*`),
        // Invalidate owner's properties list
        this.deleteCachePattern(`properties:owner:${ownerId}*`),
        // Invalidate general property listings that might include this property
        this.deleteCachePattern(`properties:list*`),
        // Invalidate property search results
        this.deleteCachePattern(`properties:search*`),
      ]);

      console.log('✅ PROPERTY SERVICE: Property updated successfully');
      return this.success(result, "Property updated successfully");
      
    } catch (error) {
      console.error('❌ PROPERTY SERVICE: Error in updateProperty:', error);
      return this.handleError(error, "updateProperty");
    }
  }

  async searchPropertiesOnMap(
    latitude: number,
    longitude: number,
    radiusInKm: number = 10,
    filters?: {
      propertyTypes?: string[];
      amenities?: string[];
      minPrice?: number;
      maxPrice?: number;
      roomTypes?: string[];
    },
    options?: { take?: number; skip?: number }
  ): Promise<MapSearchResponse> {
    try {
      // Earth's radius in kilometers
      const earthRadiusKm = 6371;

      // Calculate the bounding box for the search area
      const latDistance = radiusInKm / earthRadiusKm;
      const lngDistance =
        radiusInKm / (earthRadiusKm * Math.cos((Math.PI * latitude) / 180));

      // Calculate latitude and longitude bounds
      const latMin = latitude - (latDistance * 180) / Math.PI;
      const latMax = latitude + (latDistance * 180) / Math.PI;
      const lngMin = longitude - (lngDistance * 180) / Math.PI;
      const lngMax = longitude + (lngDistance * 180) / Math.PI;

      // Build the where clause
      const where: any = {
        AND: [
          { latitude: { gte: latMin, lte: latMax } },
          { longitude: { gte: lngMin, lte: lngMax } },
          { status: "ACTIVE" }, 
        ],
      };

      // Apply additional filters
      if (filters) {
        if (filters.propertyTypes?.length) {
          where.AND.push({ propertyType: { in: filters.propertyTypes } });
        }
        if (filters.amenities?.length) {
          where.AND.push({
            amenities: { hasSome: filters.amenities },
          });
        }
        if (filters.minPrice !== undefined) {
          where.AND.push({ amount: { gte: filters.minPrice } });
        }
        if (filters.maxPrice !== undefined) {
          where.AND.push({ amount: { lte: filters.maxPrice } });
        }
        if (filters.roomTypes?.length) {
          where.AND.push({
            roomType: { in: filters.roomTypes },
          });
        }
      }

      // Define the property type with all required fields
      type PropertyWithOwner = Prisma.PropertyGetPayload<{
        include: {
          owner: true;
          _count: { select: { views: true; likes: true } };
        };
      }>;

      // Query properties within the bounding box
      const dbProperties = (await this.prisma.property.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePic: true,
            },
          },
          _count: {
            select: {
              views: true,
              likes: true,
            },
          },
        },
        take: options?.take || 100,
        skip: options?.skip || 0,
      })) as unknown as PropertyWithOwner[];

      // Calculate distances and filter by radius
      const results = dbProperties
        .map((property) => {
          if (!property.latitude || !property.longitude) return null;

          // Haversine formula to calculate distance
          const dLat = this.deg2rad(property.latitude - latitude);
          const dLon = this.deg2rad(property.longitude - longitude);
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(latitude)) *
              Math.cos(this.deg2rad(property.latitude)) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);

          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = earthRadiusKm * c;

          if (distance <= radiusInKm) {
            const { owner, _count, ...propertyData } = property;

            // Create a properly typed result object
            const result: MapSearchResult = {
              // Required fields from Property
              id: propertyData.id,
              title: propertyData.title,
              description: propertyData.description || "",
              status: propertyData.status,
              listingType: propertyData.listingType,
              amount: propertyData.amount,
              rentalPeriod: propertyData.rentalPeriod,
              address: propertyData.address,
              city: propertyData.city,
              state: propertyData.state,
              country: propertyData.country || "Nigeria",
              latitude: propertyData.latitude,
              longitude: propertyData.longitude,
              sqft: propertyData.sqft,
              bedrooms: propertyData.bedrooms ?? 0, // Default to 0 if null/undefined
              bathrooms: propertyData.bathrooms ?? 0, // Default to 0 if null/undefined
              propertyType: propertyData.propertyType,
              roomType: propertyData.roomType,
              visitingDays: propertyData.visitingDays || [],
              visitingTimeStart: propertyData.visitingTimeStart || null,
              visitingTimeEnd: propertyData.visitingTimeEnd || null,
              amenities: propertyData.amenities || [],
              isFurnished: propertyData.isFurnished || false,
              isForStudents: propertyData.isForStudents || false,
              isStandalone: propertyData.isStandalone || false,
              totalUnits: propertyData.totalUnits || null,
              availableUnits: propertyData.availableUnits || null,
              images: propertyData.images || [],
              livingRoomImages: propertyData.livingRoomImages || [],
              bedroomImages: propertyData.bedroomImages || [],
              bathroomImages: propertyData.bathroomImages || [],
              video: propertyData.video || null,
              propertyOwnershipDocs: propertyData.propertyOwnershipDocs || [],
              propertyPlanDocs: propertyData.propertyPlanDocs || [],
              propertyDimensionDocs: propertyData.propertyDimensionDocs || [],
              featured: propertyData.featured || false,
              createdAt: propertyData.createdAt,
              updatedAt: propertyData.updatedAt,

              // Additional fields for MapSearchResult
              distanceInKm: parseFloat(distance.toFixed(2)),
              owner,
              isLiked: false,
              isViewed: false,
              viewsCount: _count?.views || 0,
              likesCount: _count?.likes || 0,
            };

            return result;
          }
          return null;
        })
        .filter((property): property is MapSearchResult => property !== null);

      return {
        success: true,
        data: results,
        total: results.length,
      };
    } catch (error) {
      return this.handleError(error, "searchPropertiesOnMap");
    }
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // private getFileType(mimetype: string): "image" | "video" | "document" {
  //   if (mimetype.startsWith("image/")) return "image";
  //   if (mimetype.startsWith("video/")) return "video";
  //   if (mimetype === "application/pdf") return "document";
  //   throw new Error("Invalid file type");
  // }

  // private getFileCategory(
  //   filename: string
  // ):
  //   | "property"
  //   | "livingRoom"
  //   | "bedroom"
  //   | "bathroom"
  //   | "ownership"
  //   | "plan"
  //   | "dimension" {
  //   if (filename.includes("living")) return "livingRoom";
  //   if (filename.includes("bedroom")) return "bedroom";
  //   if (filename.includes("bathroom")) return "bathroom";
  //   if (filename.includes("ownership")) return "ownership";
  //   if (filename.includes("plan")) return "plan";
  //   if (filename.includes("dimension")) return "dimension";
  //   return "property";
  // }

  private organizeS3Uploads(
    uploadResults: Array<{ url: string; key: string; type: string; category: string }>
  ): any {
    const result: any = {};
    
    console.log('Organizing S3 uploads:', JSON.stringify(uploadResults, null, 2));
    
    for (const upload of uploadResults) {
      const { url, key, type, category } = upload;
      
      console.log(`Processing upload - Type: ${type}, Category: ${category}, URL: ${url}`);
      
      // Handle video files
      if (type === 'video') {
        console.log(`Setting video URL: ${url}`);
        result.video = url;
        continue;
      }
      
      // Handle document types
      if (type === 'document') {
        switch (category) {
          case 'ownership':
            result.propertyOwnershipDocs = result.propertyOwnershipDocs || [];
            result.propertyOwnershipDocs.push(url);
            console.log(`Added to propertyOwnershipDocs: ${url}`);
            break;
          case 'plan':
            result.propertyPlanDocs = result.propertyPlanDocs || [];
            result.propertyPlanDocs.push(url);
            console.log(`Added to propertyPlanDocs: ${url}`);
            break;
          case 'dimension':
            result.propertyDimensionDocs = result.propertyDimensionDocs || [];
            result.propertyDimensionDocs.push(url);
            console.log(`Added to propertyDimensionDocs: ${url}`);
            break;
          default:
            // For other document types, add to a generic docs array
            result.documents = result.documents || [];
            result.documents.push({ url, category, type });
            console.log(`Added to generic documents: ${url} (${category})`);
        }
        continue;
      }
      
      // Handle images (default case)
      switch (category) {
        case 'property':
        case 'images':
          result.images = result.images || [];
          result.images.push(url);
          console.log(`Added to images: ${url}`);
          break;
        case 'livingRoom':
          result.livingRoomImages = result.livingRoomImages || [];
          result.livingRoomImages.push(url);
          console.log(`Added to livingRoomImages: ${url}`);
          break;
        case 'bedroom':
          result.bedroomImages = result.bedroomImages || [];
          result.bedroomImages.push(url);
          console.log(`Added to bedroomImages: ${url}`);
          break;
        case 'bathroom':
          result.bathroomImages = result.bathroomImages || [];
          result.bathroomImages.push(url);
          console.log(`Added to bathroomImages: ${url}`);
          break;
        default:
          // For any other category, use the category name directly
          result[category] = result[category] || [];
          result[category].push(url);
          console.log(`Added to ${category}: ${url}`);
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
      // logger.info(
      //   `Service: Getting property ${id} for user ${
      //     user?.id || "anonymous"
      //   } with role ${user?.role || "none"}`
      // );

      const property = await this.repository.findById(id, user);
      if (!property) {
        // logger.info(`Service: Property ${id} not found`);
        return this.failure("Property not found");
      }

      // logger.info(`Service: Property ${id} retrieved successfully`);
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

  async getPropertiesVisitors(
    ownerId: string,
    options: PropertySearchOptions = {}
  ): Promise<
    IBaseResponse<{ visitors: any[]; totalCount: number; pagination: any }>
  > {
    try {
      const { page = 1, limit = 10 } = options;
      const { visitors, totalCount } = await this.repository.findAllVisitors(
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
        "Properties visitors retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getPropertiesVisitors");
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
      // Convert averagePrice to number if it's a Decimal
      const processedStats = {
        ...stats,
        averagePrice:
          typeof stats.averagePrice === "number"
            ? stats.averagePrice
            : Number(stats.averagePrice.toString()),
      };
      return this.success(
        processedStats,
        "Property stats retrieved successfully"
      );
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
      // logger.info(`Geocoding address: ${address}`);
      return null; // Placeholder for geocoding logic
    } catch (error) {
      logger.warn("Failed to geocode address:", error);
      return null;
    }
  }
}

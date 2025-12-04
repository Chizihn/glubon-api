import { GraphQLUpload, FileUpload } from "graphql-upload-ts";

import {
  Resolver,
  Query,
  Mutation,
  Arg,
  UseMiddleware,
  Int,
  Ctx,
} from "type-graphql";
import {
  AccountResolveInput,
  ChangePasswordInput,
  IdentityVerificationStatusResponse,
  SubmitIdentityVerificationInput,
  UpdateProfileInput,
  UsersSearchResponse,
} from "./user.inputs";
import { Service } from "typedi";
import { UserService } from "../../services/user";
import { NotificationService } from "../../services/notification";
import { AuthMiddleware } from "../../middleware";
import { BaseResponse, Context } from "../../types";
import { User, UserStatsResponse } from "./user.types";

@Service()
@Resolver()
export class UserResolver {
  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {}

  @Query(() => User)
  @UseMiddleware(AuthMiddleware)
  async getUserById(
    @Arg('userId', () => String) userId: string,
    @Ctx() ctx: Context
  ): Promise<Partial<User> | null> {
    const result = await this.userService.getUserProfile(userId);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data!;
  }

  @Mutation(() => User)
  @UseMiddleware(AuthMiddleware)
  async updateProfile(
    @Arg("input") input: UpdateProfileInput,
    @Ctx() ctx: Context
  ): Promise<User> {
    const result = await this.userService.updateProfile(
      ctx.user!.id as string,
      input
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data as User;
  }

  @Mutation(() => User)
  @UseMiddleware(AuthMiddleware)
  async uploadProfilePicture(
    @Arg("file", () => GraphQLUpload) file: FileUpload,
    @Ctx() ctx: Context
  ): Promise<User> {
    const userId = ctx.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const result = await this.userService.uploadProfilePicture(userId, file);
    if (!result.success || !result.data) {
      throw new Error(result.message || "Failed to upload profile picture");
    }
    return result.data as User;
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async changePassword(
    @Arg("input") input: ChangePasswordInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    const result = await this.userService.changePassword(
      ctx.user!.id as string,
      input
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async submitIdentityVerification(
    @Arg("input") input: SubmitIdentityVerificationInput,
    @Ctx() ctx: Context
  ): Promise<BaseResponse> {
    try {
      // Process file uploads
      const documentImages = await Promise.all(
        input.documentImages.map(async (filePromise) => {
          const file = await filePromise;
          return file;
        })
      );

      const result = await this.userService.submitIdentityVerification(
        ctx.user!.id as string,
        {
          ...input,
          documentImages
        }
      );
      
      if (!result.success) {
        throw new Error(result.message);
      }
      return new BaseResponse(true, result.message);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to submit identity verification');
    }
  }

  @Query(() => IdentityVerificationStatusResponse)
  @UseMiddleware(AuthMiddleware)
  async getIdentityVerificationStatus(
    @Ctx() ctx: Context
  ): Promise<IdentityVerificationStatusResponse> {
    const result = await this.userService.getIdentityVerificationStatus(
      ctx.user!.id as string
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data || {};
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async deactivateAccount(@Ctx() ctx: Context): Promise<BaseResponse> {
    const result = await this.userService.deactivateAccount(
      ctx.user!.id as string
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
  }

  @Mutation(() => BaseResponse)
  @UseMiddleware(AuthMiddleware)
  async deleteAccount(@Ctx() ctx: Context): Promise<BaseResponse> {
    const result = await this.userService.deleteAccount(
      ctx.user!.id as string
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
  }

  @Query(() => UserStatsResponse)
  @UseMiddleware(AuthMiddleware)
  async getUserStats(@Ctx() ctx: Context): Promise<UserStatsResponse> {
    const result = await this.userService.getUserStats(ctx.user!.id as string);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data!;
  }

  @Query(() => UsersSearchResponse)
  async searchUsers(
    @Arg("query") query: string,
    @Arg("page", () => Int, { defaultValue: 1 }) page: number,
    @Arg("limit", () => Int, { defaultValue: 10 }) limit: number
  ): Promise<UsersSearchResponse> {
    const result = await this.userService.searchUsers(query, page, limit);
    if (!result.success) {
      throw new Error(result.message);
    }
    return new UsersSearchResponse(
      result.data.users,
      page,
      limit,
      result.data.pagination.totalItems
    );
  }
}

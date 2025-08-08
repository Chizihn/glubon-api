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
  ChangePasswordInput,
  IdentityVerificationStatusResponse,
  SubmitIdentityVerificationInput,
  UpdateProfileInput,
  UsersSearchResponse,
} from "./user.inputs";
import { UserService } from "../../services/user";
import { prisma, redis } from "../../config";
import { AuthMiddleware } from "../../middleware";
import { BaseResponse, Context } from "../../types";
import { User, UserStatsResponse } from "./user.types";

@Resolver()
export class UserResolver {
  private userService: UserService;

  constructor() {
    this.userService = new UserService(prisma, redis);
  }

  @Query(() => User)
  @UseMiddleware(AuthMiddleware)
  async getUserProfile(@Ctx() ctx: Context): Promise<Partial<User> | null> {
    const result = await this.userService.getUserProfile(
      ctx.user!.id as string
    );
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
    return result.data!;
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
    const result = await this.userService.submitIdentityVerification(
      ctx.user!.id as string,
      input
    );
    if (!result.success) {
      throw new Error(result.message);
    }
    return new BaseResponse(true, result.message);
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

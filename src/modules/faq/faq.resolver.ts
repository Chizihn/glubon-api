import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { Context } from "../../types"; // Adjust based on your project structure
import { FAQService } from "../../services/faq";
import { AuthMiddleware } from "../../middleware"; // Adjust based on your middleware
import { FAQType, FAQCategoryType } from "./faq.types";
import { CreateFAQInput, UpdateFAQInput, FAQFilter } from "./faq.inputs";

@Resolver(() => FAQType)
export class FAQResolver {
  constructor(private readonly faqService: FAQService) {}

  @Query(() => [FAQType])
  async getFAQs(
    @Arg("filter", { nullable: true }) filter: FAQFilter,
    @Ctx() ctx: Context
  ): Promise<FAQType[]> {
    return this.faqService.getFAQs(filter?.category);
  }

  @Query(() => [FAQCategoryType])
  async getFAQCategories(): Promise<FAQCategoryType[]> {
    const categories = await this.faqService.getCategories();
    return categories.map(cat => {
      const category = new FAQCategoryType();
      category.name = cat.name;
      category.count = cat.count;
      return category;
    });
  }

  @Mutation(() => FAQType)
  @UseMiddleware(AuthMiddleware)
  async createFAQ(
    @Arg("input") input: CreateFAQInput,
    @Ctx() ctx: Context
  ): Promise<FAQType> {
    return this.faqService.createFAQ({
      ...input,
      updatedBy: ctx.user!.id,
    });
  }

  @Mutation(() => FAQType)
  @UseMiddleware(AuthMiddleware)
  async updateFAQ(
    @Arg("id") id: string,
    @Arg("input") input: UpdateFAQInput,
    @Ctx() ctx: Context
  ): Promise<FAQType> {
    return this.faqService.updateFAQ(id, {
      ...input,
      updatedBy: ctx.user!.id,
    });
  }

  @Mutation(() => Boolean)
  @UseMiddleware(AuthMiddleware)
  async deleteFAQ(
    @Arg("id") id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    return this.faqService.deleteFAQ(id, ctx.user!.id);
  }
}
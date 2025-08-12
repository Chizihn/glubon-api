import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  UseMiddleware,
} from "type-graphql";
import { WalletService } from "../../services/wallet";
import {
  Transaction as TransactionType,
  Wallet as WalletType,
} from "@prisma/client";
import { Context } from "../../types";
import { Transaction, Wallet } from "../booking/booking.types";
import { AuthMiddleware } from "../../middleware";
import { RequestWithdrawalInput } from "./wallet.types";

@Resolver()
export class WalletResolver {
  private walletService: WalletService;

  @Query(() => Wallet)
  @UseMiddleware(AuthMiddleware)
  async getMyWallet(@Ctx() ctx: Context): Promise<WalletType | null> {
    const result = await this.walletService.getWallet(ctx.user!.id);
    if (!result.success) throw new Error(result.message);
    return result.data as WalletType;
  }

  @Mutation(() => Transaction)
  @UseMiddleware(AuthMiddleware)
  async requestWithdrawal(
    @Arg("input") input: RequestWithdrawalInput,
    @Ctx() ctx: Context
  ): Promise<TransactionType> {
    const result = await this.walletService.requestWithdrawal(
      input,
      ctx.user!.id
    );
    if (!result.success) throw new Error(result.message);
    return result.data;
  }
}

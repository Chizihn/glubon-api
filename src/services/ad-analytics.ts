import { PrismaClient, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { BaseService } from './base';
import { logger } from '../utils';

export interface AdAnalyticsType {
  id?: string;
  adId?: string;
  date: Date;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt?: Date;
}


export interface AdAnalyticsSummary {
  totalImpressions: number;
  totalClicks: number;
  totalRevenue: number;
  clickThroughRate: number;
  totalConversions: number;
  conversionRate: number;
  dailyStats: AdAnalyticsType[];

}

export class AdAnalyticsService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async getAnalytics(filter: {
    adIds?: string[] | undefined;
    startDate?: Date | undefined;
    endDate?: Date | undefined;
    groupByDay?: boolean | undefined;
  }): Promise<AdAnalyticsSummary> {
    try {
      const { adIds, startDate, endDate, groupByDay = true } = filter;

      const where: Prisma.AdAnalyticsWhereInput = {};

      if (adIds && adIds.length > 0) {
        where.adId = { in: adIds };
      }

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = startDate;
        if (endDate) where.date.lte = endDate;
      }

      const analytics = await this.prisma.adAnalytics.findMany({
        where,
        orderBy: { date: 'asc' },
        include: {
          ad: {
            select: {
              title: true,
              position: true,
              type: true,
            },
          },
        },
      });

      if (!groupByDay) {
        const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
        const totalClicks = analytics.reduce((sum, a) => sum + a.clicks, 0);
        const totalConversions = analytics.reduce((sum, a) => sum + a.conversions, 0);
        const totalRevenue = analytics.reduce((sum, a) => sum + a.revenue, 0);
        const clickThroughRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

        return {
          totalImpressions,
          totalClicks,
          totalConversions,
          totalRevenue,
          clickThroughRate,
          conversionRate,
          dailyStats: analytics,
        };
      }

      const groupedByDate = analytics.reduce((acc, item) => {
        const dateStr = item.date.toISOString().split('T')[0] as string;
        if (!acc[dateStr]) {
          acc[dateStr] = {
            date: item.date,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
          };
        }

        acc[dateStr].impressions += item.impressions;
        acc[dateStr].clicks += item.clicks;
        acc[dateStr].conversions += item.conversions;
        acc[dateStr].revenue += item.revenue;

        return acc;
      }, {} as Record<string, { date: Date; impressions: number; clicks: number; conversions: number; revenue: number }>);

      const dailyStats = Object.values(groupedByDate);

      const totalImpressions = dailyStats.reduce((sum, d) => sum + d.impressions, 0);
      const totalClicks = dailyStats.reduce((sum, d) => sum + d.clicks, 0);
      const totalConversions = dailyStats.reduce((sum, d) => sum + d.conversions, 0);
      const totalRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0);
      const clickThroughRate = dailyStats.length > 0 ? dailyStats.reduce((sum, d) => sum + (d.impressions > 0 ? d.clicks / d.impressions : 0), 0) / dailyStats.length * 100 : 0;
      const conversionRate = dailyStats.length > 0 ? dailyStats.reduce((sum, d) => sum + (d.clicks > 0 ? d.conversions / d.clicks : 0), 0) / dailyStats.length * 100 : 0;

      return {
        totalImpressions,
        totalClicks,
        totalConversions,
        totalRevenue,
        clickThroughRate,
        conversionRate,
        dailyStats: {...dailyStats},
      };
    } catch (error) {
      logger.error('Error getting ad analytics:', error);
      throw new Error('Failed to get ad analytics');
    }
  }

  async recordInteraction(data: {
    adId: string;
    type: 'IMPRESSION' | 'CLICK' | 'CONVERSION';
    userId?: string | undefined;
    revenue?: number | undefined;
  }): Promise<boolean> {
    const { adId, type, userId, revenue = 0 } = data;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.prisma.$transaction(async (prisma) => {
        const existing = await prisma.adAnalytics.findUnique({
          where: {
            adId_date: {
              adId,
              date: today,
            },
          },
        });

        const updateData: any = {};

        switch (type) {
          case 'IMPRESSION':
            updateData.impressions = { increment: 1 };
            break;
          case 'CLICK':
            updateData.clicks = { increment: 1 };
            break;
          case 'CONVERSION':
            updateData.conversions = { increment: 1 };
            updateData.revenue = { increment: revenue };
            break;
        }

        if (existing) {
          await prisma.adAnalytics.update({
            where: {
              adId_date: {
                adId,
                date: today,
              },
            },
            data: {
              ...updateData,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.adAnalytics.create({
            data: {
              adId,
              date: today,
              ...updateData,
              impressions: updateData.impressions ? 1 : 0,
              clicks: updateData.clicks ? 1 : 0,
              conversions: updateData.conversions ? 1 : 0,
              revenue: updateData.revenue ? revenue : 0,
            },
          });
        }

        const redisKey = `ad:${adId}:stats`;
        await this.redis.multi()
          .hincrby(redisKey, `${type.toLowerCase()}s`, 1)
          .expire(redisKey, 86400)
          .exec();
      });

      return true;
    } catch (error) {
      logger.error('Error recording ad interaction:', error);
      throw new Error('Failed to record ad interaction');
    }
  }

  async getAdStats(adId: string) {
    try {
      const redisKey = `ad:${adId}:stats`;
      const stats = await this.redis.hgetall(redisKey);

      if (Object.keys(stats).length === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStats = await this.prisma.adAnalytics.findUnique({
          where: {
            adId_date: {
              adId,
              date: today,
            },
          },
        });

        return {
          impressions: todayStats?.impressions || 0,
          clicks: todayStats?.clicks || 0,
          conversions: todayStats?.conversions || 0,
          revenue: todayStats?.revenue || 0,
        };
      }

      return {
        impressions: parseInt(stats.impressions || '0', 10),
        clicks: parseInt(stats.clicks || '0', 10),
        conversions: parseInt(stats.conversions || '0', 10),
        revenue: parseFloat(stats.revenue || '0'),
      };
    } catch (error) {
      logger.error('Error getting ad stats:', error);
      throw new Error('Failed to get ad stats');
    }
  }
}
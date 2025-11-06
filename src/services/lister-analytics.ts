// src/services/lister-analytics.service.ts
import {
  PrismaClient,
  PropertyStatus,
  BookingStatus,
  TransactionStatus,
} from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { Decimal } from "@prisma/client/runtime/library";
import {
  AnalyticsDateRangeInput,
  ListerAnalyticsResponse,
  PropertyAnalyticsResponse,
  RevenueAnalyticsResponse,
  BookingAnalyticsResponse,
  MarketInsightsResponse,
  PricePosition,
  ViewsAnalytics,
  ListerGeographicData,
  VisitorInsights,
  VisitorDemographics,
  BookingPatterns,
  PropertyAnalyticsOverview,
  Optimization,
  CompetitorAnalysis,
  CompetitorComparison,
} from "../modules/analytics/analytics.types";

type DateRange = { startDate: Date; endDate: Date };

export class ListerAnalyticsService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  /* --------------------------------------------------------------------- */
  /* PUBLIC API – called from resolver                                      */
  /* --------------------------------------------------------------------- */

  /** Full lister dashboard */
  async getListerAnalytics(
    userId: string,
    input?: AnalyticsDateRangeInput
  ): Promise<ListerAnalyticsResponse> {
    const { startDate, endDate } = this.parseDateRange(input);
    const [
      overview,
      propertyPerformance,
      viewsAnalytics,
      revenueAnalytics,
      geographicData,
      visitorInsights,
      bookingAnalytics,
    ] = await Promise.all([
      this.getOverview(userId, startDate, endDate),
      this.getPropertyPerformance(userId, startDate, endDate),
      this.getViewsAnalytics(userId, startDate, endDate),
      this.getRevenueAnalytics(userId, startDate, endDate),
      this.getGeographicData(userId, startDate, endDate),
      this.getVisitorInsights(userId, startDate, endDate),
      this.getBookingAnalytics(userId, startDate, endDate),
    ]);

    // Create a default competitor analysis object
    const competitorAnalysis: CompetitorAnalysis = {
      averageMarketPrice: 0,
      yourAveragePrice: 0,
      pricePosition: PricePosition.AVERAGE,
      marketShare: 0,
      similarProperties: 0,
    };

    return {
      overview,
      propertyPerformance,
      viewsAnalytics,
      // Map the revenue analytics response to the expected RevenueAnalytics[] type
      revenueAnalytics: revenueAnalytics.revenueOverTime.map(item => ({
        date: item.date,
        revenue: item.revenue,
        bookings: item.bookings,
        averageBookingValue: revenueAnalytics.averageBookingValue
      })),
      geographicData,
      visitorInsights,
      bookingAnalytics: {
        ...bookingAnalytics,
        // Add missing properties to match BookingAnalytics type
        totalBookings: bookingAnalytics.overview.totalBookings,
        completedBookings: bookingAnalytics.overview.confirmedBookings,
        cancelledBookings: bookingAnalytics.overview.cancelledBookings,
        averageBookingDuration: 0, // Add default value
        peakBookingTimes: [], // Add default value
        bookingsByProperty: [], // Add default value
      },
      competitorAnalysis,
    };
  }

  /** Single property deep-dive */
  async getPropertyAnalytics(
    propertyId: string,
    userId: string,
    input?: AnalyticsDateRangeInput
  ): Promise<PropertyAnalyticsResponse> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId: userId },
    });
    if (!property) throw new Error("Property not found or access denied");

    const { startDate, endDate } = this.parseDateRange(input);
    const [
      overview,
      viewsOverTime,
      visitorDemographics,
    ] = await Promise.all([
      this.getPropertyOverview(propertyId, startDate, endDate),
      this.getPropertyViewsOverTime(propertyId, startDate, endDate),
      this.getVisitorDemographics(propertyId, startDate, endDate),
    ]);

    // Create default values for the commented-out properties
    const bookingPatterns: BookingPatterns[] = [];
    const competitorComparison: CompetitorComparison = {
      similarProperties: [],
      marketPosition: 0,
      priceRecommendation: { min: 0, max: 0, optimal: 0 }
    };
    const optimization: Optimization = {
      suggestions: [],
      performanceScore: 0
    };

    return {
      overview,
      viewsOverTime,
      visitorDemographics,
      bookingPatterns,
      competitorComparison,
      optimization,
    };
  }

  /** Revenue only (separate query) */
  async getRevenueAnalyticsPublic(
    userId: string,
    input?: AnalyticsDateRangeInput
  ): Promise<RevenueAnalyticsResponse> {
    const { startDate, endDate } = this.parseDateRange(input);
    return this.getRevenueAnalytics(userId, startDate, endDate);
  }

  /** Booking only (separate query) */
  async getBookingAnalyticsPublic(
    userId: string,
    input?: AnalyticsDateRangeInput
  ): Promise<BookingAnalyticsResponse> {
    const { startDate, endDate } = this.parseDateRange(input);
    return this.getBookingAnalytics(userId, startDate, endDate);
  }

  /** Market insights – stub (you can fill later) */
  async getMarketInsights(_location?: string): Promise<MarketInsightsResponse> {
    // TODO: real market data
    return {
      marketOverview: {
        averagePrice: 0,
        totalListings: 0,
        averageOccupancy: 0,
        priceGrowth: 0,
      },
      priceAnalysis: {
        yourAveragePrice: 0,
        marketAveragePrice: 0,
        pricePosition: PricePosition.AVERAGE,
        recommendedPriceRange: { min: 0, max: 0 },
      },
      demandAnalysis: {
        searchVolume: 0,
        bookingDemand: 0,
        seasonalTrends: [],
        popularAmenities: [],
      },
      competitorAnalysis: {
        directCompetitors: [],
        marketShare: 0,
        competitiveAdvantages: [],
      },
      opportunities: {
        underservedAreas: [],
        pricingOpportunities: [],
        amenityGaps: [],
        marketTrends: [],
      },
    };
  }

  /* --------------------------------------------------------------------- */
  /* HELPERS                                                                */
  /* --------------------------------------------------------------------- */

  /** Safe date parser – public for resolver reuse */
  parseDateRange(input?: AnalyticsDateRangeInput): DateRange {
    const parse = (d?: Date | string): Date | undefined => {
      if (!d) return undefined;
      const dt = d instanceof Date ? d : new Date(d);
      return isNaN(dt.getTime()) ? undefined : dt;
    };

    const endDate = parse(input?.endDate) ?? new Date();
    let startDate = parse(input?.startDate);

    if (!startDate && input?.period) {
      startDate = new Date(endDate);
      switch (input.period) {
        case "day":
          startDate.setDate(endDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(endDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }
    }

    startDate ??= new Date(endDate);
    startDate.setDate(endDate.getDate() - 30); // default 30 days

    return { startDate, endDate };
  }

  private toNum = (d: Decimal | null | undefined): number =>
    d ? d.toNumber() : 0;

  /* --------------------------------------------------------------------- */
  /* PRIVATE IMPLEMENTATIONS (all return exact DTO shapes)                */
  /* --------------------------------------------------------------------- */

  private async getOverview(
    userId: string,
    start: Date,
    end: Date
  ): Promise<ListerAnalyticsResponse["overview"]> {
    const [props, likes, bookings, revenue] = await Promise.all([
      this.prisma.property.groupBy({
        by: ["status"],
        where: { ownerId: userId },
        _count: true,
      }),
      this.prisma.propertyLike.count({
        where: { property: { ownerId: userId }, createdAt: { gte: start, lte: end } },
      }),
      this.prisma.booking.aggregate({
        where: { property: { ownerId: userId }, createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalProps = props.reduce((s, p) => s + p._count, 0);
    const activeProps =
      props.find((p) => p.status === PropertyStatus.ACTIVE)?._count ?? 0;

    return {
      totalProperties: totalProps,
      activeProperties: activeProps,
      totalViews: 0, // no view tracking yet
      totalLikes: likes,
      totalBookings: bookings._count,
      totalRevenue: this.toNum(revenue._sum.amount),
      averageRating: 0,
      responseRate: 0,
    };
  }

  private async getPropertyPerformance(
    userId: string,
    start: Date,
    end: Date
  ): Promise<ListerAnalyticsResponse["propertyPerformance"]> {
    const props = await this.prisma.property.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        title: true,
        images: true,
        _count: {
          select: {
            likes: { where: { createdAt: { gte: start, lte: end } } },
            bookings: { where: { createdAt: { gte: start, lte: end } } },
          },
        },
        bookings: {
          where: {
            createdAt: { gte: start, lte: end },
            transactions: { some: { status: TransactionStatus.COMPLETED } },
          },
          select: {
            transactions: {
              where: { status: TransactionStatus.COMPLETED },
              select: { amount: true },
            },
          },
        },
      },
    });

    return props.map((p) => {
      const revenue = p.bookings.reduce(
        (sum, b) =>
          sum + b.transactions.reduce((s, t) => s + this.toNum(t.amount), 0),
        0
      );
      return {
        propertyId: p.id,
        title: p.title,
        views: 0,
        likes: p._count.likes,
        bookings: p._count.bookings,
        revenue,
        conversionRate: 0,
        averageRating: 0,
        images: p.images,
      };
    });
  }

  private async getViewsAnalytics(
    userId: string,
    start: Date,
    end: Date
  ): Promise<ViewsAnalytics[]> {
    // TODO: Implement views analytics retrieval
    return [];
  }

  private async getRevenueAnalytics(
    userId: string,
    start: Date,
    end: Date
  ): Promise<RevenueAnalyticsResponse> {
    const [total, overTime, byProp, payments] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true },
      }),

      this.prisma.$queryRaw<any[]>`
        SELECT
          DATE(t."createdAt") AS date,
          COALESCE(SUM(t.amount),0)::numeric AS revenue,
          COUNT(*) AS bookings,
          COALESCE(AVG(t.amount),0)::numeric AS avg_value
        FROM "Transaction" t
        JOIN "Booking" b ON t."bookingId" = b.id
        JOIN "Property" p ON b."propertyId" = p.id
        WHERE p."ownerId" = ${userId}::uuid
          AND t.status = 'COMPLETED'
          AND t."createdAt" BETWEEN ${start} AND ${end}
        GROUP BY DATE(t."createdAt")
        ORDER BY date
      `,

      this.prisma.$queryRaw<any[]>`
        SELECT
          p.id AS property_id,
          p.title AS property_title,
          COALESCE(SUM(t.amount),0)::numeric AS revenue,
          COUNT(*) AS bookings,
          COALESCE(AVG(t.amount),0)::numeric AS avg_value
        FROM "Transaction" t
        JOIN "Booking" b ON t."bookingId" = b.id
        JOIN "Property" p ON b."propertyId" = p.id
        WHERE p."ownerId" = ${userId}::uuid
          AND t.status = 'COMPLETED'
          AND t."createdAt" BETWEEN ${start} AND ${end}
        GROUP BY p.id, p.title
        ORDER BY revenue DESC
      `,

      this.prisma.transaction.groupBy({
        by: ["gateway"],
        where: {
          booking: { property: { ownerId: userId } },
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
    ]);

    const totalRev = this.toNum(total._sum.amount);
    const projected = this.projectedRevenue(totalRev, start, end);

    return {
      totalRevenue: totalRev,
      projectedRevenue: projected,
      revenueGrowth: await this.revenueGrowth(userId, start, end),
      averageBookingValue: this.toNum(total._avg.amount),

      revenueByProperty: byProp.map((r) => ({
        propertyId: r.property_id,
        propertyTitle: r.property_title,
        revenue: Number(r.revenue),
        bookings: Number(r.bookings),
        averageValue: Number(r.avg_value),
      })),

      revenueOverTime: overTime.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        bookings: Number(r.bookings),
        fees: 0,
        netRevenue: Number(r.revenue),
      })),

      paymentAnalytics: {
        totalTransactions: total._count,
        successfulPayments: total._count,
        failedPayments: 0,
        averageProcessingTime: 0,
        paymentMethods: payments.map((p) => ({
          method: p.gateway ?? "Unknown",
          count: p._count,
          percentage:
            total._count > 0 ? (p._count / total._count) * 100 : 0,
        })),
      },
    };
  }

  private async getBookingAnalytics(
    userId: string,
    start: Date,
    end: Date
  ): Promise<BookingAnalyticsResponse> {
    // Input validation
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!(start instanceof Date) || isNaN(start.getTime()) || 
        !(end instanceof Date) || isNaN(end.getTime())) {
      throw new Error('Invalid date range provided');
    }

    try {
      const [stats, trends, seasonal] = await Promise.all([
        // First query: Booking statistics by status
        this.prisma.booking.groupBy({
          by: ['status'],
          where: { 
            property: { 
              ownerId: userId,
              deletedAt: null 
            }, 
            createdAt: { 
              gte: start, 
              lte: end 
            },
            deletedAt: null
          },
          _count: { _all: true },
          _avg: { amount: true },
        }),

        // Second query: Daily booking trends with type-safe result
        this.prisma.$queryRaw<Array<{
          date: Date;
          bookings: string;
          cancellations: string;
          revenue: string;
        }>>`
          SELECT
            DATE(b."createdAt") AS date,
            COUNT(*)::text AS bookings,
            COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END)::text AS cancellations,
            COALESCE(SUM(t.amount), 0)::numeric::text AS revenue
          FROM "Booking" b
          JOIN "Property" p ON b."propertyId" = p.id
          LEFT JOIN "Transaction" t ON 
            t."bookingId" = b.id 
            AND t.status = 'COMPLETED'
            AND t."deletedAt" IS NULL
          WHERE 
            p."ownerId" = ${userId}::uuid
            AND b."createdAt" >= ${start}
            AND b."createdAt" <= ${end}
            AND b."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
          GROUP BY DATE(b."createdAt")
          ORDER BY date
        `,

        // Third query: Seasonal patterns with type-safe result
        this.prisma.$queryRaw<Array<{
          month: number;
          bookings: string;
          avg_rate: string;
        }>>`
          SELECT
            EXTRACT(MONTH FROM b."createdAt")::int AS month,
            COUNT(*)::text AS bookings,
            COALESCE(AVG(t.amount), 0)::numeric::text AS avg_rate
          FROM "Booking" b
          JOIN "Property" p ON b."propertyId" = p.id
          LEFT JOIN "Transaction" t ON 
            t."bookingId" = b.id 
            AND t.status = 'COMPLETED'
            AND t."deletedAt" IS NULL
          WHERE 
            p."ownerId" = ${userId}::uuid
            AND b."createdAt" >= ${start}
            AND b."createdAt" <= ${end}
            AND b."deletedAt" IS NULL
            AND p."deletedAt" IS NULL
          GROUP BY EXTRACT(MONTH FROM b."createdAt")
          ORDER BY month
        `,
      ]);

      // Process results with proper type safety and null checks
      const total = stats.reduce((sum, stat) => sum + (stat._count?._all || 0), 0);
      const confirmed = stats.find(s => s.status === BookingStatus.CONFIRMED)?._count?._all ?? 0;
      const cancelled = stats.find(s => s.status === BookingStatus.CANCELLED)?._count?._all ?? 0;
      const pending = stats.find(s => s.status === BookingStatus.PENDING_PAYMENT)?._count?._all ?? 0;
      
      const avgValue = stats.length > 0 
        ? stats.reduce((sum, stat) => sum + this.toNum(stat._avg?.amount), 0) / stats.length 
        : 0;

      // Get customer analytics with error handling
      let customerAnalytics: BookingAnalyticsResponse['customerAnalytics'];
      try {
        customerAnalytics = await this.getCustomerAnalytics(userId, start, end);
      } catch (error) {
        console.error('Error fetching customer analytics:', error);
        customerAnalytics = {
          repeatCustomers: 0,
          newCustomers: 0,
          averageBookingsPerCustomer: 0,
          topCustomers: [],
        };
      }

      return {
        overview: {
          totalBookings: total,
          confirmedBookings: confirmed,
          cancelledBookings: cancelled,
          pendingBookings: pending,
          averageBookingValue: avgValue,
          occupancyRate: total > 0 ? (confirmed / total) * 100 : 0,
        },
        bookingTrends: trends.map(t => ({
          date: new Date(t.date),
          bookings: parseInt(t.bookings, 10) || 0,
          cancellations: parseInt(t.cancellations, 10) || 0,
          revenue: parseFloat(t.revenue) || 0,
        })),
        seasonalPatterns: seasonal.map(s => ({
          month: s.month,
          bookings: parseInt(s.bookings, 10) || 0,
          averageRate: parseFloat(s.avg_rate) || 0,
          occupancy: 0, // This would need to be calculated based on property availability
        })),
        customerAnalytics,
        cancellationAnalytics: {
          cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
          reasonsForCancellation: [], // This would need to be populated from cancellation reasons if available
          timeToCancel: 0, // This would need to be calculated from booking and cancellation timestamps
        },
      };
    } catch (error) {
      console.error('Error in getBookingAnalytics:', error);
      // Return a default response structure with zero values in case of error
      return {
        overview: {
          totalBookings: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          pendingBookings: 0,
          averageBookingValue: 0,
          occupancyRate: 0,
        },
        bookingTrends: [],
        seasonalPatterns: [],
        customerAnalytics: {
          repeatCustomers: 0,
          newCustomers: 0,
          averageBookingsPerCustomer: 0,
          topCustomers: [],
        },
        cancellationAnalytics: {
          cancellationRate: 0,
          reasonsForCancellation: [],
          timeToCancel: 0,
        },
      };
    }
  }

  /* --------------------------------------------------------------------- */
  /* STUBS – implement when you have the data                               */
  /* --------------------------------------------------------------------- */
  private async getGeographicData(userId: string, start: Date, end: Date): Promise<ListerGeographicData[]> {
    // TODO: Implement geographic data retrieval
    return [];
  }
  private async getVisitorInsights(userId: string, start: Date, end: Date): Promise<VisitorInsights> {
    // TODO: Implement visitor insights retrieval
    return {
      totalVisitors: 0,
      returningVisitors: 0,
      averageSessionDuration: 0,
      topReferrers: [],
      deviceTypes: { mobile: 0, desktop: 0, tablet: 0 },
    };
  }
  private async getPropertyOverview(propertyId: string, start: Date, end: Date): Promise<PropertyAnalyticsOverview> {
    // TODO: Implement property overview retrieval
    return {
      totalViews: 0,
      uniqueViews: 0,
      totalLikes: 0,
      totalBookings: 0,
      revenue: 0,
      conversionRate: 0,
      averageRating: 0,
      responseTime: 0,
    };
  }
  private async getPropertyViewsOverTime(propertyId: string, start: Date, end: Date): Promise<ViewsAnalytics[]> {
    // TODO: Implement property views over time retrieval
    return [];
  }
  private async getVisitorDemographics(propertyId: string, start: Date, end: Date): Promise<VisitorDemographics> {
    // TODO: Implement visitor demographics retrieval
    return {
      ageGroups: [],
      locations: [],
      interests: []
    };
  }
  // private async getBookingPatterns(propertyId: string, start: Date, end: Date): Promise<BookingPatterns[]> {
  //   // TODO: Implement booking patterns retrieval
  //   return [];
  // }
  // private async getCompetitorComparison(propertyId: string): Promise<CompetitorComparison> {
  //   // TODO: Implement competitor comparison retrieval
  //   return {
  //     similarProperties: [],
  //     marketPosition: 0,
  //     priceRecommendation: { min: 0, max: 0, optimal: 0 }
  //   };
  // }
  // private async getOptimizationSuggestions(propertyId: string): Promise<Optimization> {
  //   // TODO: Implement optimization suggestions retrieval
  //   return {
  //     suggestions: [],
  //     performanceScore: 0
  //   };
  // }
  // private async getCompetitorAnalysis(userId: string): Promise<CompetitorAnalysis> {
  //   // TODO: Implement competitor analysis retrieval
  //   return {
  //     averageMarketPrice: 0,
  //     yourAveragePrice: 0,
  //     pricePosition: PricePosition.AVERAGE,
  //     marketShare: 0,
  //     similarProperties: 0,
  //   };
  // }

  /* --------------------------------------------------------------------- */
  /* SMALL HELPERS                                                          */
  /* --------------------------------------------------------------------- */
  private projectedRevenue(current: number, start: Date, end: Date): number {
    const daysPassed = Math.max(1, Math.ceil((new Date().getTime() - start.getTime()) / 86400000));
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    return (current / daysPassed) * totalDays;
  }

  private async revenueGrowth(userId: string, start: Date, end: Date): Promise<number> {
    const period = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - period);
    const prevEnd = start;

    const [cur, prev] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: TransactionStatus.COMPLETED,
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const c = this.toNum(cur._sum.amount);
    const p = this.toNum(prev._sum.amount);
    return p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
  }

  private async getCustomerAnalytics(
    userId: string,
    start: Date,
    end: Date
  ): Promise<BookingAnalyticsResponse["customerAnalytics"]> {
    const bookings = await this.prisma.booking.findMany({
      where: { 
        property: { ownerId: userId }, 
        createdAt: { gte: start, lte: end } 
      },
      select: { 
        renterId: true, 
        amount: true,
        createdAt: true 
      },
    });

    const map = new Map<
      string,
      { bookings: number; spent: number; first: Date }
    >();

    for (const b of bookings) {
      if (!b.renterId) continue;
      const cur = map.get(b.renterId) ?? { 
        bookings: 0, 
        spent: 0, 
        first: b.createdAt 
      };
      cur.bookings++;
      cur.spent += this.toNum(b.amount);
      map.set(b.renterId, cur);
    }

    const customers = Array.from(map.values());
    const newCust = customers.filter((c) => c.bookings === 1).length;
    const returning = customers.length - newCust;
    const totalSpent = customers.reduce((s, c) => s + c.spent, 0);
    const totalBookings = customers.reduce((s, c) => s + c.bookings, 0);

    return {
      newCustomers: newCust,
      returningCustomers: returning,
      customerLifetimeValue: customers.length ? totalSpent / customers.length : 0,
      averageBookingsPerCustomer: customers.length ? totalBookings / customers.length : 0,
    };
  }
}
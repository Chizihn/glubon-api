import { PrismaClient, PropertyStatus, BookingStatus } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService } from "./base";
import { IBaseResponse } from "../types";
import { Decimal } from "@prisma/client/runtime/library";

export interface AnalyticsDateRange {
  startDate?: Date | string;
  endDate?: Date | string;
  period?: "day" | "week" | "month" | "year";
}

export interface ListerAnalyticsOverview {
  totalProperties: number;
  activeProperties: number;
  totalViews: number;
  totalLikes: number;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  responseRate: number;
}

export interface PropertyPerformance {
  propertyId: string;
  title: string;
  views: number;
  likes: number;
  bookings: number;
  revenue: number;
  conversionRate: number;
  averageRating: number;
  images: string[];
}

export interface ViewsAnalytics {
  date: string;
  views: number;
  uniqueViews: number;
  likes: number;
  bookings: number;
}

export interface RevenueAnalytics {
  date: string;
  revenue: number;
  bookings: number;
  averageBookingValue: number;
}

export class ListerAnalyticsService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  /**
   * Get comprehensive analytics for a lister
   */
  async getListerAnalytics(
    userId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<any>> {
    try {
      const { startDate, endDate } = this.parseDateRange(dateRange);

      // Get all data in parallel
      const [
        overview,
        propertyPerformance,
        viewsAnalytics,
        revenueAnalytics,
        geographicData,
        visitorInsights,
        bookingAnalytics,
        competitorAnalysis,
      ] = await Promise.all([
        this.getOverview(userId, startDate, endDate),
        this.getPropertyPerformance(userId, startDate, endDate),
        this.getViewsAnalytics(userId, startDate, endDate),
        this.getRevenueAnalytics(userId, startDate, endDate),
        this.getGeographicData(userId, startDate, endDate),
        this.getVisitorInsights(userId, startDate, endDate),
        this.getBookingAnalytics(userId, startDate, endDate),
        this.getCompetitorAnalysis(userId),
      ]);

      const analytics = {
        overview,
        propertyPerformance,
        viewsAnalytics,
        revenueAnalytics,
        geographicData,
        visitorInsights,
        bookingAnalytics,
        competitorAnalysis,
      };

      return this.success(analytics, "Lister analytics retrieved successfully");
    } catch (error) {
      return this.handleError(error, "getListerAnalytics");
    }
  }

  /**
   * Get analytics for a specific property
   */
  async getPropertyAnalytics(
    propertyId: string,
    userId: string,
    dateRange?: AnalyticsDateRange
  ): Promise<IBaseResponse<any>> {
    try {
      // Verify property ownership
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId: userId },
      });

      if (!property) {
        return this.failure("Property not found or access denied");
      }

      const { startDate, endDate } = this.parseDateRange(dateRange);

      const [
        overview,
        viewsOverTime,
        visitorDemographics,
        bookingPatterns,
        competitorComparison,
        optimization,
      ] = await Promise.all([
        this.getPropertyOverview(propertyId, startDate, endDate),
        this.getPropertyViewsOverTime(propertyId, startDate, endDate),
        this.getVisitorDemographics(propertyId, startDate, endDate),
        this.getBookingPatterns(propertyId, startDate, endDate),
        this.getCompetitorComparison(propertyId),
        this.getOptimizationSuggestions(propertyId),
      ]);

      const analytics = {
        overview,
        viewsOverTime,
        visitorDemographics,
        bookingPatterns,
        competitorComparison,
        optimization,
      };

      return this.success(
        analytics,
        "Property analytics retrieved successfully"
      );
    } catch (error) {
      return this.handleError(error, "getPropertyAnalytics");
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [totalRevenue, revenueOverTime, revenueByProperty, paymentAnalytics] =
      await Promise.all([
        // Total revenue
        this.prisma.transaction.aggregate({
          where: {
            booking: {
              property: { ownerId: userId },
            },
            status: "COMPLETED",
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
          _count: true,
          _avg: { amount: true },
        }),

        // Revenue over time (daily) - FIXED
        this.prisma.$queryRaw`
          SELECT 
            DATE(t.created_at) as date,
            SUM(t.amount) as revenue,
            COUNT(DISTINCT b.id) as bookings,
            AVG(t.amount) as average_booking_value
          FROM transactions t
          JOIN bookings b ON t."bookingId" = b.id
          JOIN properties p ON b."propertyId" = p.id
          WHERE p."ownerId" = ${userId}
            AND t.status = 'COMPLETED'
            AND t.created_at >= ${startDate}
            AND t.created_at <= ${endDate}
          GROUP BY DATE(t.created_at)
          ORDER BY date
        `,

        // Revenue by property - FIXED
        this.prisma.$queryRaw`
          SELECT 
            p.id as property_id,
            p.title as property_title,
            SUM(t.amount) as revenue,
            COUNT(DISTINCT b.id) as bookings,
            AVG(t.amount) as average_value
          FROM transactions t
          JOIN bookings b ON t."bookingId" = b.id
          JOIN properties p ON b."propertyId" = p.id
          WHERE p."ownerId" = ${userId}
            AND t.status = 'COMPLETED'
            AND t.created_at >= ${startDate}
            AND t.created_at <= ${endDate}
          GROUP BY p.id, p.title
          ORDER BY revenue DESC
        `,

        // Payment analytics
        this.prisma.transaction.groupBy({
          by: ["status", "gateway"],
          where: {
            booking: {
              property: { ownerId: userId },
            },
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
      ]);

    return {
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      projectedRevenue: this.calculateProjectedRevenue(
        totalRevenue._sum.amount || 0,
        startDate,
        endDate
      ),
      revenueGrowth: await this.calculateRevenueGrowth(
        userId,
        startDate,
        endDate
      ),
      averageBookingValue: Number(totalRevenue._avg.amount || 0),
      revenueByProperty,
      revenueOverTime,
      paymentAnalytics: {
        totalTransactions: totalRevenue._count,
        successfulPayments: paymentAnalytics
          .filter((p) => p.status === "COMPLETED")
          .reduce((sum, p) => sum + p._count, 0),
        failedPayments: paymentAnalytics
          .filter((p) => p.status === "FAILED")
          .reduce((sum, p) => sum + p._count, 0),
        averageProcessingTime: 0,
        paymentMethods: paymentAnalytics.map((p) => ({
          method: p.gateway || "Unknown",
          count: p._count,
          percentage: (p._count / totalRevenue._count) * 100,
        })),
      },
    };
  }

  /**
   * Get booking analytics
   */
  async getBookingAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [
      bookingStats,
      bookingTrends,
      seasonalPatterns,
      cancellationAnalytics,
    ] = await Promise.all([
      // Overall booking statistics - FIXED
      this.prisma.booking.groupBy({
        by: ["status"],
        where: {
          property: { ownerId: userId },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
        _avg: { amount: true },
      }),

      // Booking trends over time - FIXED
      this.prisma.$queryRaw`
        SELECT 
          DATE(b.created_at) as date,
          COUNT(*) as bookings,
          COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END) as cancellations,
          SUM(b.amount) as revenue
        FROM bookings b
        JOIN properties p ON b."propertyId" = p.id
        WHERE p."ownerId" = ${userId}
          AND b.created_at >= ${startDate}
          AND b.created_at <= ${endDate}
        GROUP BY DATE(b.created_at)
        ORDER BY date
      `,

      // Seasonal patterns (monthly) - FIXED
      this.prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM b.created_at) as month,
          COUNT(*) as bookings,
          AVG(b.amount) as average_rate,
          COUNT(*) * 100.0 / NULLIF((
            SELECT COUNT(*) 
            FROM bookings b2 
            JOIN properties p2 ON b2."propertyId" = p2.id 
            WHERE p2."ownerId" = ${userId}
          ), 0) as occupancy
        FROM bookings b
        JOIN properties p ON b."propertyId" = p.id
        WHERE p."ownerId" = ${userId}
          AND b.created_at >= ${startDate}
          AND b.created_at <= ${endDate}
        GROUP BY EXTRACT(MONTH FROM b.created_at)
        ORDER BY month
      `,

      // Cancellation analytics
      this.prisma.booking.findMany({
        where: {
          property: { ownerId: userId },
          status: BookingStatus.CANCELLED,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalBookings = bookingStats.reduce(
      (sum, stat) => sum + stat._count,
      0
    );
    const confirmedBookings =
      bookingStats.find((s) => s.status === BookingStatus.CONFIRMED)?._count ||
      0;
    const cancelledBookings =
      bookingStats.find((s) => s.status === BookingStatus.CANCELLED)?._count ||
      0;

    return {
      overview: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        pendingBookings:
          bookingStats.find((s) => s.status === BookingStatus.PENDING_PAYMENT)
            ?._count || 0,
        averageBookingValue:
          bookingStats.find((s) => s._avg.amount)?._avg.amount || 0,
        occupancyRate:
          totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0,
      },
      bookingTrends,
      seasonalPatterns,
      customerAnalytics: await this.getCustomerAnalytics(
        userId,
        startDate,
        endDate
      ),
      cancellationAnalytics: {
        cancellationRate:
          totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
        reasonsForCancellation: [],
        timeToCancel: 0,
      },
    };
  }

  // Private helper methods

  private parseDateRange(dateRange?: AnalyticsDateRange): {
    startDate: Date;
    endDate: Date;
  } {
    const parseDate = (
      dateInput: Date | string | undefined
    ): Date | undefined => {
      if (!dateInput) return undefined;
      if (dateInput instanceof Date) {
        return !isNaN(dateInput.getTime()) ? dateInput : undefined;
      }
      if (typeof dateInput === "string") {
        if (!dateInput.trim()) return undefined;
        const parsed = new Date(dateInput);
        return !isNaN(parsed.getTime()) ? parsed : undefined;
      }
      return undefined;
    };

    const endDate = parseDate(dateRange?.endDate) || new Date();
    let startDate: Date;

    const parsedStartDate = parseDate(dateRange?.startDate);
    if (parsedStartDate) {
      startDate = parsedStartDate;
    } else if (dateRange?.period) {
      startDate = new Date(endDate);
      switch (dateRange.period) {
        case "day":
          startDate.setDate(startDate.getDate() - 1);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }
    } else {
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
    }

    return { startDate, endDate };
  }

  private async getOverview(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ListerAnalyticsOverview> {
    const [propertyStats, viewStats, likeStats, bookingStats, revenueStats] =
      await Promise.all([
        this.prisma.property.groupBy({
          by: ["status"],
          where: { ownerId: userId },
          _count: true,
        }),
        this.prisma.propertyView.aggregate({
          where: {
            property: { ownerId: userId },
            viewedAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
        this.prisma.propertyLike.aggregate({
          where: {
            property: { ownerId: userId },
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
        this.prisma.booking.aggregate({
          where: {
            property: { ownerId: userId },
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
        }),
        this.prisma.transaction.aggregate({
          where: {
            booking: {
              property: { ownerId: userId },
            },
            status: "COMPLETED",
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        }),
      ]);

    const totalProperties = propertyStats.reduce(
      (sum, stat) => sum + stat._count,
      0
    );
    const activeProperties =
      propertyStats.find((s) => s.status === PropertyStatus.ACTIVE)?._count ||
      0;

    return {
      totalProperties,
      activeProperties,
      totalViews: viewStats._count,
      totalLikes: likeStats._count,
      totalBookings: bookingStats._count,
      totalRevenue: Number(revenueStats._sum.amount || 0),
      averageRating: 0,
      responseRate: 0,
    };
  }

  private async getPropertyPerformance(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<PropertyPerformance[]> {
    const properties = await this.prisma.property.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: {
            views: {
              where: { viewedAt: { gte: startDate, lte: endDate } },
            },
            likes: {
              where: { createdAt: { gte: startDate, lte: endDate } },
            },
            bookings: {
              where: { createdAt: { gte: startDate, lte: endDate } },
            },
          },
        },
        bookings: {
          where: {
            createdAt: { gte: startDate, lte: endDate },
            transactions: {
              some: { status: "COMPLETED" },
            },
          },
          include: {
            transactions: {
              where: { status: "COMPLETED" },
            },
          },
        },
      },
    });

    return properties.map((property) => {
      const revenue = property.bookings.reduce(
        (sum, booking) =>
          sum +
          booking.transactions.reduce(
            (txSum, tx) => txSum + Number(tx.amount),
            0
          ),
        0
      );
      const views = property._count.views;
      const bookings = property._count.bookings;

      return {
        propertyId: property.id,
        title: property.title,
        views,
        likes: property._count.likes,
        bookings,
        revenue,
        conversionRate: views > 0 ? (bookings / views) * 100 : 0,
        averageRating: 0,
        images: property.images,
      };
    });
  }

  private async getViewsAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ViewsAnalytics[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(pv.viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT pv."userId") as unique_views,
        COUNT(DISTINCT pl.id) as likes,
        COUNT(DISTINCT b.id) as bookings
      FROM property_views pv
      JOIN properties p ON pv."propertyId" = p.id
      LEFT JOIN property_likes pl ON pl."propertyId" = p.id 
        AND DATE(pl.created_at) = DATE(pv.viewed_at)
      LEFT JOIN bookings b ON b."propertyId" = p.id 
        AND DATE(b.created_at) = DATE(pv.viewed_at)
      WHERE p."ownerId" = ${userId}
        AND pv.viewed_at >= ${startDate}
        AND pv.viewed_at <= ${endDate}
      GROUP BY DATE(pv.viewed_at)
      ORDER BY date
    `;

    return result.map((row) => ({
      date: row.date,
      views: Number(row.views),
      uniqueViews: Number(row.unique_views),
      likes: Number(row.likes),
      bookings: Number(row.bookings),
    }));
  }

  private async getGeographicData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    return [];
  }

  private async getVisitorInsights(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const totalVisitors = await this.prisma.propertyView.count({
      where: {
        property: { ownerId: userId },
        viewedAt: { gte: startDate, lte: endDate },
      },
    });

    const uniqueVisitors = await this.prisma.propertyView.groupBy({
      by: ["userId"],
      where: {
        property: { ownerId: userId },
        viewedAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    return {
      totalVisitors,
      returningVisitors: uniqueVisitors.filter((v) => v._count > 1).length,
      averageSessionDuration: 0,
      topReferrers: [],
      deviceTypes: {
        mobile: 0,
        desktop: 0,
        tablet: 0,
      },
    };
  }

  private async getCompetitorAnalysis(userId: string): Promise<any> {
    return {
      averageMarketPrice: 0,
      yourAveragePrice: 0,
      pricePosition: "average",
      marketShare: 0,
      similarProperties: 0,
    };
  }

  private async getPropertyOverview(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const [property, viewStats, likeStats, bookingStats, revenueStats] = 
      await Promise.all([
        this.prisma.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            amount: true,
            images: true,
            createdAt: true,
          },
        }),
        this.prisma.propertyView.count({
          where: {
            propertyId,
            viewedAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.propertyLike.count({
          where: {
            propertyId,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.booking.aggregate({
          where: {
            propertyId,
            createdAt: { gte: startDate, lte: endDate },
          },
          _count: true,
          _avg: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            booking: { propertyId },
            status: "COMPLETED",
            createdAt: { gte: startDate, lte: endDate },
          },
          _sum: { amount: true },
        }),
      ]);

    return {
      property,
      totalViews: viewStats,
      totalLikes: likeStats,
      totalBookings: bookingStats._count,
      averageBookingValue: Number(bookingStats._avg.amount || 0),
      totalRevenue: Number(revenueStats._sum.amount || 0),
      conversionRate: viewStats > 0 ? (bookingStats._count / viewStats) * 100 : 0,
    };
  }

  private async getPropertyViewsOverTime(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(pv.viewed_at) as date,
        COUNT(*) as views,
        COUNT(DISTINCT pv."userId") as unique_views
      FROM property_views pv
      WHERE pv."propertyId" = ${propertyId}
        AND pv.viewed_at >= ${startDate}
        AND pv.viewed_at <= ${endDate}
      GROUP BY DATE(pv.viewed_at)
      ORDER BY date
    `;

    return result.map((row) => ({
      date: row.date,
      views: Number(row.views),
      uniqueViews: Number(row.unique_views),
    }));
  }

  private async getVisitorDemographics(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const totalVisitors = await this.prisma.propertyView.count({
      where: {
        propertyId,
        viewedAt: { gte: startDate, lte: endDate },
      },
    });

    const uniqueVisitors = await this.prisma.propertyView.groupBy({
      by: ["userId"],
      where: {
        propertyId,
        viewedAt: { gte: startDate, lte: endDate },
      },
      _count: true,
    });

    return {
      totalVisitors,
      uniqueVisitors: uniqueVisitors.length,
      returningVisitors: uniqueVisitors.filter((v) => v._count > 1).length,
      newVisitors: uniqueVisitors.filter((v) => v._count === 1).length,
    };
  }

  private async getBookingPatterns(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(*) as bookings,
        SUM(b.amount) as revenue,
        AVG(b.amount) as average_value
      FROM bookings b
      WHERE b."propertyId" = ${propertyId}
        AND b.created_at >= ${startDate}
        AND b.created_at <= ${endDate}
      GROUP BY DATE(b.created_at)
      ORDER BY date
    `;

    return result.map((row) => ({
      date: row.date,
      bookings: Number(row.bookings),
      revenue: Number(row.revenue),
      averageValue: Number(row.average_value),
    }));
  }

  private async getCompetitorComparison(propertyId: string): Promise<any> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        amount: true,
        propertyType: true,
        city: true,
        state: true,
      },
    });

    if (!property) {
      return {
        yourPrice: 0,
        marketAveragePrice: 0,
        pricePosition: "unknown",
        similarProperties: 0,
      };
    }

    // Get similar properties in the same area
    const similarProperties = await this.prisma.property.aggregate({
      where: {
        id: { not: propertyId },
        propertyType: property.propertyType,
        city: property.city,
        state: property.state,
        status: PropertyStatus.ACTIVE,
      },
      _avg: { amount: true },
      _count: true,
    });

    const yourPrice = Number(property.amount);
    const marketAverage = Number(similarProperties._avg.amount || 0);
    
    let pricePosition = "average";
    if (marketAverage > 0) {
      const priceDiff = ((yourPrice - marketAverage) / marketAverage) * 100;
      if (priceDiff > 15) pricePosition = "above_market";
      else if (priceDiff < -15) pricePosition = "below_market";
    }

    return {
      yourPrice,
      marketAveragePrice: marketAverage,
      pricePosition,
      similarProperties: similarProperties._count,
    };
  }

  private async getOptimizationSuggestions(propertyId: string): Promise<any> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        _count: {
          select: {
            views: true,
            likes: true,
            bookings: true,
          },
        },
      },
    });

    if (!property) {
      return {
        suggestions: [],
        performanceScore: 0,
      };
    }

    const suggestions: string[] = [];
    let performanceScore = 100;

    // Check images
    if (property.images.length < 5) {
      suggestions.push("Add more property images (minimum 5 recommended)");
      performanceScore -= 15;
    }

    // Check description
    if (property.description.length < 100) {
      suggestions.push("Add a more detailed property description");
      performanceScore -= 10;
    }

    // Check amenities
    if (property.amenities.length < 3) {
      suggestions.push("List more amenities to attract renters");
      performanceScore -= 10;
    }

    // Check views to likes ratio
    const viewsToLikesRatio = property._count.views > 0 
      ? (property._count.likes / property._count.views) * 100 
      : 0;
    
    if (viewsToLikesRatio < 5 && property._count.views > 20) {
      suggestions.push("Low engagement rate - consider updating images or pricing");
      performanceScore -= 15;
    }

    // Check conversion rate
    const conversionRate = property._count.views > 0 
      ? (property._count.bookings / property._count.views) * 100 
      : 0;
    
    if (conversionRate < 2 && property._count.views > 50) {
      suggestions.push("Low conversion rate - review pricing and property details");
      performanceScore -= 20;
    }

    // Check location data
    if (!property.latitude || !property.longitude) {
      suggestions.push("Add exact location coordinates for better visibility");
      performanceScore -= 10;
    }

    return {
      suggestions,
      performanceScore: Math.max(0, performanceScore),
    };
  }

  private async getCustomerAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    customerRetentionRate: number;
    customerLifetimeValue: number;
    averageBookingsPerCustomer: number;
  }> {
    // Get all bookings for the period
    const bookings = await this.prisma.booking.findMany({
      where: {
        property: { ownerId: userId },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        renterId: true,
        amount: true,
        createdAt: true,
      },
    });

    // Group bookings by customer
    const customerBookings = bookings.reduce<Record<string, { 
      bookings: number; 
      totalSpent: number; 
      firstBooking: Date 
    }>>((acc, booking) => {
      if (!booking.renterId) return acc;

      if (!acc[booking.renterId]) {
        acc[booking.renterId] = {
          bookings: 0,
          totalSpent: 0,
          firstBooking: booking.createdAt,
        };
      }

      const customer = acc[booking.renterId];
      if (customer) {
        customer.bookings++;
        if (booking.amount) {
          customer.totalSpent += new Decimal(booking.amount).toNumber();
        }
      }
      return acc;
    }, {});

    const customerIds = Object.keys(customerBookings);
    const customers = Object.values(customerBookings);
    const newCustomers = customers.filter(c => c.bookings === 1).length;
    const returningCustomers = customers.filter(c => c.bookings > 1).length;
    const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalBookings = customers.reduce((sum, c) => sum + c.bookings, 0);
    
    return {
      totalCustomers: customerIds.length,
      newCustomers,
      returningCustomers,
      customerRetentionRate: customerIds.length > 0 
        ? (returningCustomers / customerIds.length) * 100 
        : 0,
      customerLifetimeValue: customerIds.length > 0 
        ? totalRevenue / customerIds.length 
        : 0,
      averageBookingsPerCustomer: customerIds.length > 0 
        ? totalBookings / customerIds.length 
        : 0,
    };
  }

  private calculateProjectedRevenue(
    currentRevenue: any,
    startDate: Date,
    endDate: Date
  ): number {
    const daysPassed = Math.ceil(
      (new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysPassed === 0) return Number(currentRevenue || 0);

    const dailyAverage = Number(currentRevenue || 0) / daysPassed;
    return dailyAverage * totalDays;
  }

  private async calculateRevenueGrowth(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    const [currentRevenue, previousRevenue] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: "COMPLETED",
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { property: { ownerId: userId } },
          status: "COMPLETED",
          createdAt: { gte: previousStartDate, lte: previousEndDate },
        },
        _sum: { amount: true },
      }),
    ]);

    const current = Number(currentRevenue._sum.amount || 0);
    const previous = Number(previousRevenue._sum.amount || 0);

    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
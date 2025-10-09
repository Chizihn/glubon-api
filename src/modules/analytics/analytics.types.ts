import { ObjectType, Field, InputType, registerEnumType, GraphQLISODateTime } from "type-graphql";

enum AnalyticsPeriod {
  day = "day",
  week = "week",
  month = "month",
  year = "year",
}

registerEnumType(AnalyticsPeriod, {
  name: "AnalyticsPeriod",
  description: "Time period for analytics",
});

export enum PricePosition {
  BELOW = "below",
  AVERAGE = "average",
  ABOVE = "above",
}

registerEnumType(PricePosition, {
  name: "PricePosition",
  description: "Price position relative to market",
});

@InputType()
export class AnalyticsDateRangeInput {
  @Field(() => GraphQLISODateTime, { nullable: true })
  startDate?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endDate?: Date;

  @Field(() => AnalyticsPeriod, { nullable: true })
  period?: AnalyticsPeriod;
}

@ObjectType()
export class ListerAnalyticsOverview {
  @Field()
  totalProperties: number;

  @Field()
  activeProperties: number;

  @Field()
  totalViews: number;

  @Field()
  totalLikes: number;

  @Field()
  totalBookings: number;

  @Field()
  totalRevenue: number;

  @Field()
  averageRating: number;

  @Field()
  responseRate: number;
}

@ObjectType()
export class PropertyPerformance {
  @Field()
  propertyId: string;

  @Field()
  title: string;

  @Field()
  views: number;

  @Field()
  likes: number;

  @Field()
  bookings: number;

  @Field()
  revenue: number;

  @Field()
  conversionRate: number;

  @Field()
  averageRating: number;

  @Field(() => [String])
  images: string[];
}

@ObjectType()
export class ViewsAnalytics {
  @Field()
  date: string;

  @Field()
  views: number;

  @Field()
  uniqueViews: number;

  @Field()
  likes: number;

  @Field()
  bookings: number;
}

@ObjectType()
export class RevenueAnalytics {
  @Field()
  date: string;

  @Field()
  revenue: number;

  @Field()
  bookings: number;

  @Field()
  averageBookingValue: number;
}

@ObjectType()
export class ListerGeographicData {
  @Field()
  location: string;

  @Field()
  views: number;

  @Field()
  bookings: number;

  @Field()
  revenue: number;
}

@ObjectType()
export class DeviceTypes {
  @Field()
  mobile: number;

  @Field()
  desktop: number;

  @Field()
  tablet: number;
}

@ObjectType()
export class VisitorInsights {
  @Field()
  totalVisitors: number;

  @Field()
  returningVisitors: number;

  @Field()
  averageSessionDuration: number;

  @Field(() => [String])
  topReferrers: string[];

  @Field(() => DeviceTypes)
  deviceTypes: DeviceTypes;
}

@ObjectType()
export class BookingsByProperty {
  @Field()
  propertyId: string;

  @Field()
  propertyTitle: string;

  @Field()
  bookings: number;

  @Field()
  revenue: number;
}

@ObjectType()
export class BookingAnalytics {
  @Field()
  totalBookings: number;

  @Field()
  completedBookings: number;

  @Field()
  cancelledBookings: number;

  @Field()
  averageBookingDuration: number;

  @Field(() => [String])
  peakBookingTimes: string[];

  @Field(() => [BookingsByProperty])
  bookingsByProperty: BookingsByProperty[];
}

@ObjectType()
export class CompetitorAnalysis {
  @Field()
  averageMarketPrice: number;

  @Field()
  yourAveragePrice: number;

  @Field(() => PricePosition)
  pricePosition: PricePosition;

  @Field()
  marketShare: number;

  @Field()
  similarProperties: number;
}

@ObjectType()
export class ListerAnalyticsResponse {
  @Field(() => ListerAnalyticsOverview)
  overview: ListerAnalyticsOverview;

  @Field(() => [PropertyPerformance])
  propertyPerformance: PropertyPerformance[];

  @Field(() => [ViewsAnalytics])
  viewsAnalytics: ViewsAnalytics[];

  @Field(() => [RevenueAnalytics])
  revenueAnalytics: RevenueAnalytics[];

  @Field(() => [ListerGeographicData])
  geographicData: ListerGeographicData[];

  @Field(() => VisitorInsights)
  visitorInsights: VisitorInsights;

  @Field(() => BookingAnalytics)
  bookingAnalytics: BookingAnalytics;

  @Field(() => CompetitorAnalysis)
  competitorAnalysis: CompetitorAnalysis;
}

// Property Analytics Types
@ObjectType()
export class PropertyAnalyticsOverview {
  @Field()
  totalViews: number;

  @Field()
  uniqueViews: number;

  @Field()
  totalLikes: number;

  @Field()
  totalBookings: number;

  @Field()
  revenue: number;

  @Field()
  conversionRate: number;

  @Field()
  averageRating: number;

  @Field()
  responseTime: number;
}

@ObjectType()
export class AgeGroup {
  @Field()
  range: string;

  @Field()
  percentage: number;
}

@ObjectType()
export class LocationData {
  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  count: number;
}

@ObjectType()
export class VisitorDemographics {
  @Field(() => [AgeGroup])
  ageGroups: AgeGroup[];

  @Field(() => [LocationData])
  locations: LocationData[];

  @Field(() => [String])
  interests: string[];
}

@ObjectType()
export class BookingPatterns {
  @Field()
  date: string;

  @Field()
  bookings: number;

  @Field()
  revenue: number;

  @Field()
  averageStayDuration: number;
}

@ObjectType()
export class SimilarProperty {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  price: number;

  @Field()
  views: number;

  @Field()
  bookings: number;

  @Field()
  rating: number;
}

@ObjectType()
export class PriceRecommendation {
  @Field()
  min: number;

  @Field()
  max: number;

  @Field()
  optimal: number;
}

@ObjectType()
export class CompetitorComparison {
  @Field(() => [SimilarProperty])
  similarProperties: SimilarProperty[];

  @Field()
  marketPosition: number;

  @Field(() => PriceRecommendation)
  priceRecommendation: PriceRecommendation;
}

@ObjectType()
export class OptimizationSuggestion {
  @Field()
  type: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  impact: string;

  @Field()
  priority: number;
}

@ObjectType()
export class Optimization {
  @Field(() => [OptimizationSuggestion])
  suggestions: OptimizationSuggestion[];

  @Field()
  performanceScore: number;
}

@ObjectType()
export class PropertyAnalyticsResponse {
  @Field(() => PropertyAnalyticsOverview)
  overview: PropertyAnalyticsOverview;

  @Field(() => [ViewsAnalytics])
  viewsOverTime: ViewsAnalytics[];

  @Field(() => VisitorDemographics)
  visitorDemographics: VisitorDemographics;

  @Field(() => [BookingPatterns])
  bookingPatterns: BookingPatterns[];

  @Field(() => CompetitorComparison)
  competitorComparison: CompetitorComparison;

  @Field(() => Optimization)
  optimization: Optimization;
}

// Revenue Analytics Types
@ObjectType()
export class RevenueByProperty {
  @Field()
  propertyId: string;

  @Field()
  propertyTitle: string;

  @Field()
  revenue: number;

  @Field()
  bookings: number;

  @Field()
  averageValue: number;
}

@ObjectType()
export class RevenueOverTime {
  @Field()
  date: string;

  @Field()
  revenue: number;

  @Field()
  bookings: number;

  @Field()
  fees: number;

  @Field()
  netRevenue: number;
}

@ObjectType()
export class PaymentMethod {
  @Field()
  method: string;

  @Field()
  count: number;

  @Field()
  percentage: number;
}

@ObjectType()
export class PaymentAnalytics {
  @Field()
  totalTransactions: number;

  @Field()
  successfulPayments: number;

  @Field()
  failedPayments: number;

  @Field()
  averageProcessingTime: number;

  @Field(() => [PaymentMethod])
  paymentMethods: PaymentMethod[];
}

@ObjectType()
export class RevenueAnalyticsResponse {
  @Field()
  totalRevenue: number;

  @Field()
  projectedRevenue: number;

  @Field()
  revenueGrowth: number;

  @Field()
  averageBookingValue: number;

  @Field(() => [RevenueByProperty])
  revenueByProperty: RevenueByProperty[];

  @Field(() => [RevenueOverTime])
  revenueOverTime: RevenueOverTime[];

  @Field(() => PaymentAnalytics)
  paymentAnalytics: PaymentAnalytics;
}

// Booking Analytics Types
@ObjectType()
export class BookingOverview {
  @Field()
  totalBookings: number;

  @Field()
  confirmedBookings: number;

  @Field()
  cancelledBookings: number;

  @Field()
  pendingBookings: number;

  @Field()
  averageBookingValue: number;

  @Field()
  occupancyRate: number;
}

@ObjectType()
export class BookingTrends {
  @Field()
  date: string;

  @Field()
  bookings: number;

  @Field()
  cancellations: number;

  @Field()
  revenue: number;
}

@ObjectType()
export class SeasonalPatterns {
  @Field()
  month: number;

  @Field()
  bookings: number;

  @Field()
  averageRate: number;

  @Field()
  occupancy: number;
}

@ObjectType()
export class CustomerAnalytics {
  @Field()
  newCustomers: number;

  @Field()
  returningCustomers: number;

  @Field()
  customerLifetimeValue: number;

  @Field()
  averageBookingsPerCustomer: number;
}

@ObjectType()
export class CancellationReason {
  @Field()
  reason: string;

  @Field()
  count: number;

  @Field()
  percentage: number;
}

@ObjectType()
export class CancellationAnalytics {
  @Field()
  cancellationRate: number;

  @Field(() => [CancellationReason])
  reasonsForCancellation: CancellationReason[];

  @Field()
  timeToCancel: number;
}

@ObjectType()
export class BookingAnalyticsResponse {
  @Field(() => BookingOverview)
  overview: BookingOverview;

  @Field(() => [BookingTrends])
  bookingTrends: BookingTrends[];

  @Field(() => [SeasonalPatterns])
  seasonalPatterns: SeasonalPatterns[];

  @Field(() => CustomerAnalytics)
  customerAnalytics: CustomerAnalytics;

  @Field(() => CancellationAnalytics)
  cancellationAnalytics: CancellationAnalytics;
}

// Market Insights Types
@ObjectType()
export class MarketOverview {
  @Field()
  averagePrice: number;

  @Field()
  totalListings: number;

  @Field()
  averageOccupancy: number;

  @Field()
  priceGrowth: number;
}

@ObjectType()
export class PriceRange {
  @Field()
  min: number;

  @Field()
  max: number;
}

@ObjectType()
export class PriceAnalysis {
  @Field()
  yourAveragePrice: number;

  @Field()
  marketAveragePrice: number;

  @Field(() => PricePosition)
  pricePosition: PricePosition;

  @Field(() => PriceRange)
  recommendedPriceRange: PriceRange;
}

@ObjectType()
export class DemandAnalysis {
  @Field()
  searchVolume: number;

  @Field()
  bookingDemand: number;

  @Field(() => [String])
  seasonalTrends: string[];

  @Field(() => [String])
  popularAmenities: string[];
}

@ObjectType()
export class DirectCompetitor {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field()
  price: number;

  @Field()
  rating: number;

  @Field()
  occupancyRate: number;
}

@ObjectType()
export class MarketCompetitorAnalysis {
  @Field(() => [DirectCompetitor])
  directCompetitors: DirectCompetitor[];

  @Field()
  marketShare: number;

  @Field(() => [String])
  competitiveAdvantages: string[];
}

@ObjectType()
export class MarketOpportunities {
  @Field(() => [String])
  underservedAreas: string[];

  @Field(() => [String])
  pricingOpportunities: string[];

  @Field(() => [String])
  amenityGaps: string[];

  @Field(() => [String])
  marketTrends: string[];
}

@ObjectType()
export class MarketInsightsResponse {
  @Field(() => MarketOverview)
  marketOverview: MarketOverview;

  @Field(() => PriceAnalysis)
  priceAnalysis: PriceAnalysis;

  @Field(() => DemandAnalysis)
  demandAnalysis: DemandAnalysis;

  @Field(() => MarketCompetitorAnalysis)
  competitorAnalysis: MarketCompetitorAnalysis;

  @Field(() => MarketOpportunities)
  opportunities: MarketOpportunities;
}

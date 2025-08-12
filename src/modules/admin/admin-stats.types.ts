import { Decimal } from "@prisma/client/runtime/library";
import {
  ObjectType,
  Field,
  Int,
  Float,
  GraphQLISODateTime,
} from "type-graphql";

@ObjectType()
export class MonthlyGrowthResponse {
  @Field(() => Int)
  users: number;

  @Field(() => Int)
  properties: number;
}

@ObjectType()
export class DashboardStatsUsers {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  verified: number;

  @Field(() => Int)
  suspended: number;

  @Field(() => Int)
  newToday: number;

  @Field(() => Int)
  newThisWeek: number;

  @Field(() => Int)
  newThisMonth: number;
}

@ObjectType()
export class DashboardStatsProperties {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  featured: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  newToday: number;

  @Field(() => Int)
  newThisWeek: number;

  @Field(() => Int)
  newThisMonth: number;
}

@ObjectType()
export class DashboardStatsVerifications {
  @Field(() => Int)
  pendingIdentity: number;

  @Field(() => Int)
  pendingOwnership: number;

  @Field(() => Int)
  approvedToday: number;

  @Field(() => Int)
  rejectedToday: number;
}

@ObjectType()
export class DashboardStatsActivity {
  @Field(() => Int)
  totalConversations: number;

  @Field(() => Int)
  activeConversationsToday: number;

  @Field(() => Int)
  totalMessages: number;

  @Field(() => Int)
  messagesToday: number;

  @Field(() => Int)
  totalPropertyViews: number;

  @Field(() => Int)
  propertyViewsToday: number;

  @Field(() => Int)
  totalPropertyLikes: number;

  @Field(() => Int)
  propertyLikesToday: number;
}

@ObjectType()
export class DashboardStatsAdmin {
  @Field(() => Int)
  totalAdmins: number;

  @Field(() => Int)
  activeAdmins: number;

  @Field(() => Int)
  actionsToday: number;
}

@ObjectType()
export class GrowthStats {
  @Field(() => Int)
  current: number;

  @Field(() => Int)
  lastMonth: number;

  @Field(() => Float)
  percentChange: number;
}

@ObjectType()
export class DashboardStatsGrowth {
  @Field(() => GrowthStats)
  users: GrowthStats;

  @Field(() => GrowthStats)
  properties: GrowthStats;
}

@ObjectType()
export class DashboardStats {
  @Field(() => DashboardStatsUsers)
  users: DashboardStatsUsers;

  @Field(() => DashboardStatsProperties)
  properties: DashboardStatsProperties;

  @Field(() => DashboardStatsVerifications)
  verifications: DashboardStatsVerifications;

  @Field(() => DashboardStatsActivity)
  activity: DashboardStatsActivity;

  @Field(() => DashboardStatsAdmin)
  admin: DashboardStatsAdmin;

  @Field(() => DashboardStatsGrowth)
  growth: DashboardStatsGrowth;

  @Field(() => Int)
  totalRevenue: number;
}

@ObjectType()
export class AnalyticsOverviewResponse {
  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  newUsers: number;

  @Field(() => Int)
  totalProperties: number;

  @Field(() => Int)
  newProperties: number;

  @Field(() => Int)
  pendingProperties: number;

  @Field(() => Int)
  activeProperties: number;

  @Field(() => Int)
  totalConversations: number;

  @Field(() => Int)
  totalMessages: number;

  @Field(() => Int)
  pendingVerifications: number;

  @Field(() => Int)
  approvedVerifications: number;
}

@ObjectType()
export class AdminStatsResponse {
  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  activeUsers: number;

  @Field(() => Int)
  totalProperties: number;

  @Field(() => Int)
  activeProperties: number;

  @Field(() => Int)
  pendingVerifications: number;

  @Field(() => Int)
  totalRevenue: number;

  @Field(() => MonthlyGrowthResponse)
  monthlyGrowth: MonthlyGrowthResponse;
}

@ObjectType()
export class UserGrowthData {
  @Field()
  date: string;

  @Field(() => Int)
  renters: number;

  @Field(() => Int)
  listers: number;

  @Field(() => Int)
  total: number;
}

@ObjectType()
export class PropertyGrowthData {
  @Field()
  date: string;

  @Field(() => Int)
  active: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  total: number;
}

@ObjectType()
export class ActivityData {
  @Field()
  date: string;

  @Field(() => Int)
  views: number;

  @Field(() => Int)
  likes: number;

  @Field(() => Int)
  messages: number;

  @Field(() => Int)
  conversations: number;
}

@ObjectType()
export class GeographicData {
  @Field()
  state: string;

  @Field(() => Int)
  users: number;

  @Field(() => Int)
  properties: number;
}

@ObjectType()
export class PerformanceTopProperty {
  @Field()
  id: string;

  @Field()
  title: string;

  @Field(() => Int)
  views: number;

  @Field(() => Int)
  likes: number;

  @Field(() => Int)
  conversations: number;
}

@ObjectType()
export class PerformanceMetrics {
  @Field(() => Float)
  conversionRate: number;

  @Field(() => Float)
  likeRate: number;

  @Field(() => Float)
  userRetentionRate: number;

  @Field(() => Float)
  avgVerificationTime: number;

  @Field(() => Float)
  avgPropertyApprovalTime: number;

  @Field(() => Int)
  activeUsersLast7Days: number;

  @Field(() => Int)
  activeUsersLast30Days: number;

  @Field(() => [PerformanceTopProperty])
  topPerformingProperties: PerformanceTopProperty[];
}

@ObjectType()
export class DashboardAnalyticsCharts {
  @Field(() => [UserGrowthData])
  userGrowth: UserGrowthData[];

  @Field(() => [PropertyGrowthData])
  propertyGrowth: PropertyGrowthData[];

  @Field(() => [ActivityData])
  activity: ActivityData[];

  @Field(() => [GeographicData])
  geographic: GeographicData[];
}

@ObjectType()
export class DashboardAnalyticsResponse {
  @Field(() => DashboardStats)
  overview: DashboardStats;

  @Field(() => DashboardAnalyticsCharts)
  charts: DashboardAnalyticsCharts;

  @Field(() => PerformanceMetrics)
  performance: PerformanceMetrics;
}

@ObjectType()
export class RevenueData {
  @Field(() => GraphQLISODateTime)
  date: Date;

  @Field(() => Decimal)
  revenue: number;

  @Field(() => Int)
  transactions: number;

  @Field(() => Int)
  subscriptions: number;

  @Field(() => Decimal)
  commissions: number;
}

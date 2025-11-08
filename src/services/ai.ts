// src/services/AIService.ts
import { PrismaClient, PropertyType, RoomType, RentalPeriod, PropertyListingType } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService, CACHE_TTL } from "./base";
import { extractPriceRange } from "../utils/parsePrice";
import { 
  containsLocationKeyword, 
  extractCanonicalLocation 
} from "../constants/locationKeywords";

export interface AIQueryInput {
  query: string;
  userId?: string;
  context?: {
    location?: { latitude: number; longitude: number; city?: string } | null;
    budget?: { min: number; max: number } | null;
    preferences?: string[] | null;
  } | null;
}

export interface AIResponse {
  answer: string;
  suggestedProperties?: string[];
  followUpQuestions?: string[];
}

interface Analysis {
  intent: "search" | "compare" | "info" | "recommend" | "budget" | "location" | "general";
  criteria: {
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    location?: string;
    propertyType?: PropertyType[];
    roomType?: RoomType[];
    listingType?: PropertyListingType;
    rentalPeriod?: RentalPeriod;
    isFurnished?: boolean;
    isForStudents?: boolean;
    amenities?: string[];
    sqftMin?: number;
    sqftMax?: number;
  };
  confidence: number;
  naturalLanguage: {
    isQuestion: boolean;
    needsComparison: boolean;
    needsRecommendation: boolean;
  };
}

export class AIService extends BaseService {
  // Common amenities for pattern matching
  private readonly COMMON_AMENITIES = [
    'parking', 'pool', 'gym', 'security', 'generator', 'wifi', 
    'air conditioning', 'elevator', 'balcony', 'garden', 'cctv',
    'water', 'electricity', 'kitchen', 'laundry', 'storage'
  ];

  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async processQuery(input: AIQueryInput): Promise<AIResponse> {
    const { query, context } = input;

    try {
      // 1. Analyze the natural language query
      const analysis = await this.analyzeQuery(query, context);
      
      // 2. Handle different intents
      switch (analysis.intent) {
        case 'info':
          return this.handleInfoQuery(query, analysis);
        case 'compare':
          return this.handleComparisonQuery(query, analysis);
        case 'recommend':
          return this.handleRecommendationQuery(analysis, context);
        case 'budget':
          return this.handleBudgetQuery(analysis);
        default:
          // Standard search
          const properties = await this.getRelevantProperties(analysis.criteria, context);
          return this.generateResponse(query, properties, analysis);
      }
    } catch (error) {
      console.error("AI processing error:", error);
      return this.fallbackResponse();
    }
  }

  // ── ENHANCED QUERY ANALYSIS ──────────────────────────────────────────────
  private async analyzeQuery(query: string, context?: any): Promise<Analysis> {
    const cacheKey = `ai:analysis:${query.toLowerCase()}`;
    const cached = await this.getCache<Analysis>(cacheKey);
    if (cached) return cached;

    const lower = query.toLowerCase();
    const criteria: Analysis["criteria"] = {};
    let confidence = 0.5;

    // Natural language detection
    const isQuestion = /^(what|where|which|how|when|why|can|do|does|is|are|show|find|tell)/i.test(query);
    const needsComparison = /compare|versus|vs|difference|better|cheaper|more expensive/i.test(lower);
    const needsRecommendation = /recommend|suggest|best|good|nice|perfect|ideal/i.test(lower);

    // 1. PRICE EXTRACTION
    const priceRange = extractPriceRange(query);
    if (priceRange.min !== undefined) {
      criteria.minPrice = priceRange.min;
      confidence += 0.1;
    }
    if (priceRange.max !== undefined) {
      criteria.maxPrice = priceRange.max;
      confidence += 0.1;
    }

    // Budget keywords
    if (/cheap|affordable|budget|low cost/i.test(lower)) {
      criteria.maxPrice = criteria.maxPrice || 300000;
      confidence += 0.1;
    }
    if (/expensive|luxury|premium|high end/i.test(lower)) {
      criteria.minPrice = criteria.minPrice || 1000000;
      confidence += 0.1;
    }

    // 2. BEDROOMS & BATHROOMS
    const bedroomMatch = lower.match(/(\d+)\s*(bed|bedroom|br)/i);
    if (bedroomMatch?.[1]) {
      criteria.bedrooms = parseInt(bedroomMatch[1], 10);
      confidence += 0.15;
    }

    const bathroomMatch = lower.match(/(\d+)\s*(bath|bathroom)/i);
    if (bathroomMatch?.[1]) {
      criteria.bathrooms = parseInt(bathroomMatch[1], 10);
      confidence += 0.1;
    }

    // 3. ROOM TYPE
    criteria.roomType = this.extractRoomType(lower);
    if (criteria.roomType.length > 0) confidence += 0.15;

    // 4. PROPERTY TYPE
    criteria.propertyType = this.extractPropertyType(lower);
    if (criteria.propertyType.length > 0) confidence += 0.15;

    // 5. LOCATION
    if (containsLocationKeyword(lower)) {
      const location = extractCanonicalLocation(lower);
      if (location) {
        criteria.location = location;
        confidence += 0.2;
      }
    } else if (context?.location?.city) {
      criteria.location = context.location.city;
      confidence += 0.05;
    }

    // 6. LISTING TYPE & RENTAL PERIOD
    if (/\b(for sale|buy|purchase)\b/i.test(lower)) {
      criteria.listingType = PropertyListingType.SALE;
      confidence += 0.1;
    } else if (/\blease\b/i.test(lower)) {
      criteria.listingType = PropertyListingType.LEASE;
      confidence += 0.1;
    } else {
      criteria.listingType = PropertyListingType.RENT; // Default
    }

    // Rental period
    if (/weekly|week|per week/i.test(lower)) {
      criteria.rentalPeriod = RentalPeriod.WEEKLY;
    } else if (/monthly|month|per month/i.test(lower)) {
      criteria.rentalPeriod = RentalPeriod.MONTHLY;
    } else if (/quarterly|quarter/i.test(lower)) {
      criteria.rentalPeriod = RentalPeriod.QUARTERLY;
    } else if (/yearly|annual|year|per year/i.test(lower)) {
      criteria.rentalPeriod = RentalPeriod.YEARLY;
    }

    // 7. FURNISHED
    if (/furnished|with furniture/i.test(lower)) {
      criteria.isFurnished = true;
      confidence += 0.1;
    } else if (/unfurnished|without furniture/i.test(lower)) {
      criteria.isFurnished = false;
      confidence += 0.1;
    }

    // 8. STUDENT ACCOMMODATION
    if (/student|students|university|college/i.test(lower)) {
      criteria.isForStudents = true;
      confidence += 0.1;
    }

    // 9. AMENITIES
    criteria.amenities = this.extractAmenities(lower);
    if (criteria.amenities.length > 0) confidence += 0.1;

    // 10. SIZE (SQFT)
    const sqftMatch = lower.match(/(\d+)\s*(?:to|-)?\s*(\d+)?\s*(?:sqft|sq ft|square feet)/i);
    if (sqftMatch) {
      criteria.sqftMin = parseInt(sqftMatch[1] as string, 10);
      if (sqftMatch[2]) {
        criteria.sqftMax = parseInt(sqftMatch[2] as string, 10);
      }
      confidence += 0.1;
    }

    // DETERMINE INTENT
    let intent: Analysis["intent"] = "general";
    
    if (/how much|cost|price|afford|budget/i.test(lower)) {
      intent = "budget";
    } else if (needsComparison) {
      intent = "compare";
    } else if (needsRecommendation) {
      intent = "recommend";
    } else if (/what is|tell me about|explain|how does/i.test(lower)) {
      intent = "info";
    } else if (/show|find|search|looking for|need|want/i.test(lower)) {
      intent = "search";
    } else if (Object.keys(criteria).length > 2) {
      intent = "search";
    }

    const result: Analysis = {
      intent,
      criteria,
      confidence: Math.min(confidence, 1.0),
      naturalLanguage: {
        isQuestion,
        needsComparison,
        needsRecommendation,
      },
    };

    await this.setCache(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── EXTRACT ROOM TYPE ─────────────────────────────────────────────────────
  private extractRoomType(query: string): RoomType[] {
    const types: RoomType[] = [];
    
    if (/studio/i.test(query)) types.push(RoomType.STUDIO);
    if (/self.contain|self contain/i.test(query)) types.push(RoomType.SELF_CONTAIN);
    if (/1.bed|one.bed/i.test(query)) types.push(RoomType.ONE_BEDROOM);
    if (/2.bed|two.bed/i.test(query)) types.push(RoomType.TWO_BEDROOM);
    if (/3.bed|three.bed/i.test(query)) types.push(RoomType.THREE_BEDROOM);
    if (/4.bed|four.bed/i.test(query)) types.push(RoomType.FOUR_BEDROOM);
    if (/5\+.bed|five.plus|5 or more/i.test(query)) types.push(RoomType.FIVE_PLUS_BEDROOM);

    return types;
  }

  // ── EXTRACT PROPERTY TYPE ─────────────────────────────────────────────────
  private extractPropertyType(query: string): PropertyType[] {
    const types: PropertyType[] = [];
    
    if (/bungalow/i.test(query)) types.push(PropertyType.BUNGALOW);
    if (/apartment|flat/i.test(query)) types.push(PropertyType.APARTMENT);
    if (/duplex/i.test(query)) types.push(PropertyType.DUPLEX);
    if (/mansion/i.test(query)) types.push(PropertyType.MANSION);
    if (/self.contain/i.test(query)) types.push(PropertyType.SELF_CONTAIN);
    if (/2.story|two.story/i.test(query)) types.push(PropertyType.TWO_STORY);
    if (/3.story|three.story/i.test(query)) types.push(PropertyType.THREE_STORY);
    if (/4.story|four.story/i.test(query)) types.push(PropertyType.FOUR_STORY);
    if (/high.rise|6\+.story/i.test(query)) types.push(PropertyType.SIX_PLUS_STORY);

    return types;
  }

  // ── EXTRACT AMENITIES ─────────────────────────────────────────────────────
  private extractAmenities(query: string): string[] {
    const found: string[] = [];
    
    for (const amenity of this.COMMON_AMENITIES) {
      const regex = new RegExp(`\\b${amenity}\\b`, 'i');
      if (regex.test(query)) {
        found.push(amenity);
      }
    }

    return found;
  }

  // ── PROPERTY FETCH (ENHANCED) ─────────────────────────────────────────────
  private async getRelevantProperties(
    criteria: Analysis["criteria"],
    context?: any
  ) {
    const cacheKey = `ai:props:${JSON.stringify(criteria)}`;
    const cached = await this.getCache<any[]>(cacheKey);
    if (cached) return cached;

    const where: any = {
      status: 'ACTIVE',
    };

    // Price filter
    if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
      where.amount = {};
      if (criteria.minPrice !== undefined) where.amount.gte = criteria.minPrice;
      if (criteria.maxPrice !== undefined) where.amount.lte = criteria.maxPrice;
    }

    // Bedrooms & Bathrooms
    if (criteria.bedrooms !== undefined) where.bedrooms = criteria.bedrooms;
    if (criteria.bathrooms !== undefined) where.bathrooms = criteria.bathrooms;

    // Property & Room Type
    if (criteria.propertyType && criteria.propertyType.length > 0) {
      where.propertyType = { in: criteria.propertyType };
    }
    if (criteria.roomType && criteria.roomType.length > 0) {
      where.roomType = { in: criteria.roomType };
    }

    // Listing type & Rental period
    if (criteria.listingType) where.listingType = criteria.listingType;
    if (criteria.rentalPeriod) where.rentalPeriod = criteria.rentalPeriod;

    // Furnished & Student
    if (criteria.isFurnished !== undefined) where.isFurnished = criteria.isFurnished;
    if (criteria.isForStudents !== undefined) where.isForStudents = criteria.isForStudents;

    // Size
    if (criteria.sqftMin !== undefined || criteria.sqftMax !== undefined) {
      where.sqft = {};
      if (criteria.sqftMin) where.sqft.gte = criteria.sqftMin;
      if (criteria.sqftMax) where.sqft.lte = criteria.sqftMax;
    }

    // Location
    if (criteria.location) {
      where.OR = [
        { city: { contains: criteria.location, mode: "insensitive" } },
        { state: { contains: criteria.location, mode: "insensitive" } },
        { address: { contains: criteria.location, mode: "insensitive" } },
      ];
    }

    // Amenities (all must be present)
    if (criteria.amenities && criteria.amenities.length > 0) {
      where.AND = criteria.amenities.map(amenity => ({
        amenities: { has: amenity }
      }));
    }

    try {
      const properties = await this.prisma.property.findMany({
        where,
        take: 8,
        select: {
          id: true,
          title: true,
          amount: true,
          address: true,
          city: true,
          state: true,
          bedrooms: true,
          bathrooms: true,
          sqft: true,
          propertyType: true,
          roomType: true,
          rentalPeriod: true,
          listingType: true,
          isFurnished: true,
          isForStudents: true,
          amenities: true,
          images: true,
          featured: true,
        },
        orderBy: [
          { featured: 'desc' },
          { createdAt: 'desc' }
        ],
      });

      if (properties.length > 0) {
        await this.setCache(cacheKey, properties, CACHE_TTL.MEDIUM as any);
      }

      return properties;
    } catch (error) {
      console.error("Property fetch error:", error);
      return [];
    }
  }

  // ── HANDLE INFO QUERIES ───────────────────────────────────────────────────
  private async handleInfoQuery(query: string, analysis: Analysis): Promise<AIResponse> {
    const lower = query.toLowerCase();
    let answer = "";

    if (/what is|what are/i.test(lower)) {
      if (/rental period/i.test(lower)) {
        answer = "Rental periods can be weekly, monthly, quarterly, or yearly. Most properties are rented monthly, but you can filter by your preferred period.";
      } else if (/property type/i.test(lower)) {
        answer = "We have various property types: Bungalows, Apartments, Duplexes, Mansions, Self-contains, and multi-story buildings (2-6+ stories).";
      } else if (/amenities/i.test(lower)) {
        answer = "Common amenities include parking, pools, gyms, security, generators, WiFi, air conditioning, elevators, and more. You can filter properties by specific amenities.";
      }
    } else if (/how much|cost|price/i.test(lower)) {
      // Get average prices
      const stats = await this.getPropertyStatistics(analysis.criteria);
      answer = `Average rent in ${analysis.criteria.location || 'your area'} is ₦${stats.avgPrice.toLocaleString()}/month. Prices range from ₦${stats.minPrice.toLocaleString()} to ₦${stats.maxPrice.toLocaleString()}.`;
    }

    return {
      answer: answer || "I can help you with property searches, comparisons, and recommendations. What would you like to know?",
      followUpQuestions: this.generateFollowUpQuestions(analysis.criteria, []),
    };
  }

  // ── HANDLE COMPARISON ─────────────────────────────────────────────────────
  private async handleComparisonQuery(query: string, analysis: Analysis): Promise<AIResponse> {
    const properties = await this.getRelevantProperties(analysis.criteria);
    
    if (properties.length < 2) {
      return {
        answer: "I need at least 2 properties to compare. Please refine your search criteria.",
        followUpQuestions: ["Show me 2-bedroom apartments", "Find properties in Lekki"],
      };
    }

    const [prop1, prop2] = properties.slice(0, 2);
    const priceDiff = Math.abs(Number(prop1.amount) - Number(prop2.amount));
    const cheaper = Number(prop1.amount) < Number(prop2.amount) ? prop1 : prop2;

    const answer = `Comparing "${prop1.title}" (₦${Number(prop1.amount).toLocaleString()}) vs "${prop2.title}" (₦${Number(prop2.amount).toLocaleString()}). "${cheaper.title}" is ₦${priceDiff.toLocaleString()} cheaper. Both have ${prop1.bedrooms || 0} bedrooms.`;

    return {
      answer,
      suggestedProperties: [prop1.id, prop2.id],
      followUpQuestions: ["Show me more options", "What about 3-bedroom?"],
    };
  }

  // ── HANDLE RECOMMENDATIONS ────────────────────────────────────────────────
  private async handleRecommendationQuery(analysis: Analysis, context?: any): Promise<AIResponse> {
    const properties = await this.getRelevantProperties(analysis.criteria, context);
    
    if (properties.length === 0) {
      return {
        answer: "Let me help you find the perfect property. What's your budget and preferred location?",
        followUpQuestions: [
          "What's your budget range?",
          "Which area do you prefer?",
          "How many bedrooms do you need?",
        ],
      };
    }

    const featured = properties.filter(p => p.featured);
    const top = featured.length > 0 ? featured[0] : properties[0];

    const answer = `I recommend "${top.title}" in ${top.city}. It's ${top.isFurnished ? 'furnished' : 'unfurnished'}, has ${top.bedrooms} bedrooms, and costs ₦${Number(top.amount).toLocaleString()}/${top.rentalPeriod?.toLowerCase()}. ${top.amenities?.slice(0, 3).join(', ')} included.`;

    return {
      answer,
      suggestedProperties: properties.map(p => p.id).slice(0, 5),
      followUpQuestions: [
        "Show me similar properties",
        "What about furnished options?",
        "Are there cheaper alternatives?",
      ],
    };
  }

  // ── HANDLE BUDGET QUERIES ─────────────────────────────────────────────────
  private async handleBudgetQuery(analysis: Analysis): Promise<AIResponse> {
    const stats = await this.getPropertyStatistics(analysis.criteria);
    
    const answer = `Based on ${analysis.criteria.location || 'current listings'}, properties range from ₦${stats.minPrice.toLocaleString()} to ₦${stats.maxPrice.toLocaleString()}. Average is ₦${stats.avgPrice.toLocaleString()}/month. What's your budget?`;

    return {
      answer,
      followUpQuestions: [
        "Show me properties under ₦300k",
        "What can I get for ₦500k?",
        "Show me budget-friendly options",
      ],
    };
  }

  // ── GET STATISTICS ────────────────────────────────────────────────────────
  private async getPropertyStatistics(criteria: Analysis["criteria"]) {
    const where: any = { status: 'ACTIVE' };
    if (criteria.location) {
      where.OR = [
        { city: { contains: criteria.location, mode: "insensitive" } },
        { state: { contains: criteria.location, mode: "insensitive" } },
      ];
    }

    const result = await this.prisma.property.aggregate({
      where,
      _avg: { amount: true },
      _min: { amount: true },
      _max: { amount: true },
    });

    return {
      avgPrice: Number(result._avg.amount) || 0,
      minPrice: Number(result._min.amount) || 0,
      maxPrice: Number(result._max.amount) || 0,
    };
  }

  // ── GENERATE RESPONSE (ENHANCED) ──────────────────────────────────────────
  private generateResponse(
    query: string,
    properties: any[],
    analysis: Analysis
  ): AIResponse {
    if (properties.length === 0) {
      return this.generateNoResultsResponse(analysis.criteria, query);
    }

    const answer = this.buildEnhancedAnswer(properties, analysis);
    const followUpQuestions = this.generateFollowUpQuestions(analysis.criteria, properties);

    return {
      answer,
      suggestedProperties: properties.map(p => p.id),
      followUpQuestions,
    };
  }

  // ── BUILD ENHANCED ANSWER ─────────────────────────────────────────────────
  private buildEnhancedAnswer(properties: any[], analysis: Analysis): string {
    const first = properties[0];
    const parts: string[] = [];

    // Greeting based on confidence
    if (analysis.confidence > 0.7) {
      parts.push(`Perfect! Found ${properties.length} ${properties.length === 1 ? 'property' : 'properties'} matching your needs.`);
    } else {
      parts.push(`I found ${properties.length} ${properties.length === 1 ? 'property' : 'properties'} for you.`);
    }

    // Top match details
    let details = `"${first.title}" in ${first.city} - ₦${Number(first.amount).toLocaleString()}`;
    
    if (first.rentalPeriod) {
      details += `/${first.rentalPeriod.toLowerCase()}`;
    }
    
    if (first.bedrooms) {
      details += ` • ${first.bedrooms} bed`;
    }
    if (first.bathrooms) {
      details += `, ${first.bathrooms} bath`;
    }
    if (first.sqft) {
      details += ` • ${first.sqft} sqft`;
    }
    if (first.isFurnished) {
      details += ` • Furnished`;
    }

    parts.push(details);

    // Amenities highlight
    if (first.amenities?.length > 0) {
      parts.push(`Includes: ${first.amenities.slice(0, 3).join(', ')}`);
    }

    // Additional options
    if (properties.length > 1) {
      parts.push(`+ ${properties.length - 1} more ${properties.length > 2 ? 'options' : 'option'} available`);
    }

    return parts.join('. ') + '.';
  }

  // ── NO RESULTS RESPONSE (ENHANCED) ────────────────────────────────────────
  private generateNoResultsResponse(criteria: Analysis["criteria"], query: string): AIResponse {
    let message = `No exact matches for "${query}". `;
    const suggestions: string[] = [];

    if (criteria.maxPrice) {
      suggestions.push(`Try budget up to ₦${(criteria.maxPrice * 1.3).toLocaleString()}`);
    }
    if (criteria.location) {
      suggestions.push(`Explore nearby areas to ${criteria.location}`);
    }
    if (criteria.bedrooms && criteria.bedrooms > 1) {
      suggestions.push(`Consider ${criteria.bedrooms - 1} bedroom options`);
    }
    if (criteria.amenities && criteria.amenities.length > 2) {
      suggestions.push(`Reduce amenity requirements`);
    }

    if (suggestions.length > 0) {
      message += suggestions.slice(0, 2).join(' or ') + '.';
    }

    return {
      answer: message,
      suggestedProperties: [],
      followUpQuestions: [
        "Show me all available properties",
        "What's in nearby areas?",
        "Increase my budget",
      ],
    };
  }

  // ── FOLLOW-UP QUESTIONS (ENHANCED) ────────────────────────────────────────
  private generateFollowUpQuestions(criteria: Analysis["criteria"], properties: any[]): string[] {
    const questions: string[] = [];

    // Ask for missing important criteria
    if (!criteria.maxPrice) {
      questions.push("What's your budget range?");
    }
    if (!criteria.bedrooms) {
      questions.push("How many bedrooms do you need?");
    }
    if (!criteria.location) {
      questions.push("Which area interests you?");
    }

    // Property-specific questions
    if (properties.length > 0) {
      const first = properties[0];
      if (!criteria.isFurnished) {
        questions.push("Do you need it furnished?");
      }
      if (first.isForStudents && !criteria.isForStudents) {
        questions.push("Are you a student?");
      }
      if (!criteria.amenities || criteria.amenities.length === 0) {
        questions.push("Any specific amenities needed?");
      }
    }

    return questions.slice(0, 3);
  }

  // ── FALLBACK RESPONSE ─────────────────────────────────────────────────────
  private fallbackResponse(): AIResponse {
    return {
      answer: "I'm having trouble understanding. Try: 'Show 2-bedroom apartments in Lekki under ₦500k' or 'Find furnished student housing'",
      suggestedProperties: [],
      followUpQuestions: [
        "What's your budget?",
        "How many bedrooms?",
        "Preferred location?",
      ],
    };
  }
}
// src/services/AIService.ts
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";
import { BaseService, CACHE_TTL } from "./base";
import { extractPriceRange } from "../utils/parsePrice";
import { containsLocationKeyword, extractCanonicalLocation } from "../constants/locationKeywords";


export interface AIQueryInput {
  query: string;
  userId?: string;
  context?: {
    location?: { latitude: number; longitude: number };
    budget?: { min: number; max: number };
    preferences?: string[];
  };
}

export interface AIResponse {
  answer: string;
  suggestedProperties?: any[];
  followUpQuestions?: string[];
}

interface Analysis {
  intent: "budget" | "location" | "bedrooms" | "search" | "general";
  criteria: {
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    location?: string;
  };
  followUpQuestions: string[];
}

export class AIService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis) {
    super(prisma, redis);
  }

  async processQuery(input: AIQueryInput): Promise<AIResponse> {
    const { query, context } = input;

    try {
      const analysis = await this.analyzeQuery(query, context);
      const properties = await this.getRelevantProperties(analysis.criteria);
      return this.generateResponse(query, properties, analysis);
    } catch (error) {
      console.error("AI processing error:", error);
      return this.fallbackResponse();
    }
  }

  // ── ANALYSIS ─────────────────────────────────────────────────────
  private async analyzeQuery(query: string, context?: any): Promise<Analysis> {
    const cacheKey = `ai:analysis:${query.toLowerCase()}`;
    const cached = await this.getCache<Analysis>(cacheKey);
    if (cached) return cached;

    const lower = query.toLowerCase();
    const criteria: Analysis["criteria"] = {};

    // 1. Price
    const priceRange = extractPriceRange(query);
    if (priceRange.min !== undefined) criteria.minPrice = priceRange.min;
    if (priceRange.max !== undefined) criteria.maxPrice = priceRange.max;

    // 2. Bedrooms
    const bedMatch = query.match(/(\d+)\s*(bed|bedroom|br)/i);
    if (bedMatch && bedMatch[1]) {
      criteria.bedrooms = parseInt(bedMatch[1], 10);
    }

    // 3. Location
    if (containsLocationKeyword(lower)) {
      const location = extractCanonicalLocation(lower);
      if (location) {
        criteria.location = location;
      }
    }

    // 4. Intent
    let intent: Analysis["intent"] = "general";
    if ((criteria.minPrice !== undefined || criteria.maxPrice !== undefined) || lower.includes("budget")) {
      intent = "budget";
    } else if (criteria.location || lower.includes("area")) {
      intent = "location";
    } else if (criteria.bedrooms !== undefined) {
      intent = "bedrooms";
    } else if (lower.includes("show") || lower.includes("find")) {
      intent = "search";
    }

    const followUp = this.generateFollowUpQuestions(criteria);

    const result: Analysis = { 
      intent, 
      criteria, 
      followUpQuestions: followUp 
    };
    await this.setCache(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  // ── FOLLOW-UP QUESTIONS ──────────────────────────────────────────
  private generateFollowUpQuestions(criteria: Analysis["criteria"]): string[] {
    const questions: string[] = [];

    if (!criteria.maxPrice) questions.push("What's your budget range?");
    if (!criteria.bedrooms) questions.push("How many bedrooms do you need?");
    if (!criteria.location) questions.push("Which area are you interested in?");

    return questions.slice(0, 3);
  }

  // ── PROPERTY FETCH ───────────────────────────────────────────────
  private async getRelevantProperties(criteria: Analysis["criteria"]) {
    const cacheKey = `ai:props:${JSON.stringify(criteria)}`;
    const cached = await this.getCache<any[]>(cacheKey);
    if (cached) return cached;

    const where: any = { isActive: true };

    if (criteria.minPrice !== undefined) where.amount = { ...where.amount, gte: criteria.minPrice };
    if (criteria.maxPrice !== undefined) where.amount = { ...where.amount, lte: criteria.maxPrice };
    if (criteria.bedrooms !== undefined) where.bedrooms = criteria.bedrooms;
    if (criteria.location) {
      where.OR = [
        { city: { contains: criteria.location, mode: "insensitive" } },
        { state: { contains: criteria.location, mode: "insensitive" } },
        { address: { contains: criteria.location, mode: "insensitive" } },
      ];
    }

    const properties = await this.prisma.property.findMany({
      where,
      take: 5,
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
        latitude: true,
        longitude: true,
        propertyType: true,
        rentalPeriod: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (properties.length > 0) {
      await this.setCache(cacheKey, properties, CACHE_TTL.LONG);
    }

    return properties;
  }

  // ── RESPONSE GENERATION ──────────────────────────────────────────
  private generateResponse(
    query: string,
    properties: any[],
    analysis: Analysis
  ): AIResponse {
    const { criteria } = analysis;

    if (properties.length === 0) {
      let msg = `I couldn't find any properties matching "${query}". `;
      if (criteria.maxPrice) msg += `Try increasing your budget above ₦${criteria.maxPrice.toLocaleString()}. `;
      if (criteria.location) msg += `Consider nearby areas to ${criteria.location}. `;
      return { answer: msg, suggestedProperties: [], followUpQuestions: analysis.followUpQuestions };
    }

    const first = properties[0];
    let answer = `Found ${properties.length} propert${properties.length === 1 ? "y" : "ies"}. `;

    answer += `Top match: "${first.title}" in ${first.city || first.state} `;
    answer += `for ₦${first.amount?.toLocaleString()}`;
    if (first.bedrooms) answer += ` • ${first.bedrooms} bed${first.bedrooms > 1 ? "s" : ""}`;
    answer += ".";

    if (properties.length > 1) {
      answer += ` I have ${properties.length - 1} more option${properties.length > 2 ? "s" : ""}.`;
    }

    return {
      answer,
      suggestedProperties: properties,
      followUpQuestions: analysis.followUpQuestions,
    };
  }

  private fallbackResponse(): AIResponse {
    return {
      answer: "I'm having trouble right now. Try: '2-bedroom in Lekki under ₦500k'",
      suggestedProperties: [],
      followUpQuestions: [
        "What's your budget range?",
        "How many bedrooms do you need?",
        "Which area are you interested in?",
      ],
    };
  }
}
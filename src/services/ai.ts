import { PrismaClient } from "@prisma/client";

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

export class AIService {
  constructor(private prisma: PrismaClient) {}

  async processQuery(input: AIQueryInput): Promise<AIResponse> {
    const { query, context } = input;

    try {
      // Parse user intent and extract search criteria
      const analysis = await this.analyzeQuery(query, context);

      // Get relevant properties based on analysis
      const properties = await this.getRelevantProperties(analysis);

      // Generate response
      const response = await this.generateResponse(query, properties, analysis);

      return response;
    } catch (error) {
      console.error("AI processing error:", error);
      // Fallback to simple response
      return {
        answer:
          "I'm having trouble processing your request right now. Please try a simpler query like 'Show me 2-bedroom apartments under ₦500k'.",
        suggestedProperties: [],
        followUpQuestions: [
          "What's your budget range?",
          "How many bedrooms do you need?",
          "Which area are you interested in?",
        ],
      };
    }
  }

  private async analyzeQuery(query: string, context?: any) {
    // Simple intent parsing for now - you can enhance with Vercel AI SDK later
    const lowerQuery = query.toLowerCase();

    // Extract basic criteria from query
    const searchCriteria: any = {};

    // Extract price/budget
    const priceMatch = query.match(/₦?(\d+(?:,\d+)*(?:k|m)?)/gi);
    if (priceMatch) {
      const prices = priceMatch.map((p) => {
        let num = parseFloat(p.replace(/[₦,]/g, ""));
        if (p.toLowerCase().includes("k")) num *= 1000;
        if (p.toLowerCase().includes("m")) num *= 1000000;
        return num;
      });
      if (prices.length === 1) {
        searchCriteria.maxPrice = prices[0];
      } else if (prices.length >= 2) {
        searchCriteria.minPrice = Math.min(...prices);
        searchCriteria.maxPrice = Math.max(...prices);
      }
    }

    // Extract bedrooms
    const bedroomMatch = query.match(/(\d+)[\s-]*(bed|bedroom|br)/i);
    if (bedroomMatch) {
      searchCriteria.bedrooms = parseInt(String(bedroomMatch[1]));
    }

    // Extract location keywords
    const locationKeywords = [
      "abia",
      "adamawa",
      "akwa ibom",
      "anambra",
      "bauchi",
      "bayelsa",
      "benue",
      "borno",
      "cross river",
      "delta",
      "ebonyi",
      "edo",
      "ekiti",
      "enugu",
      "gombe",
      "imo",
      "jigawa",
      "kaduna",
      "kano",
      "katsina",
      "kebbi",
      "kogi",
      "kwara",
      "lagos",
      "nasarawa",
      "niger",
      "ogun",
      "ondo",
      "osun",
      "oyo",
      "plateau",
      "rivers",
      "sokoto",
      "taraba",
      "yobe",
      "zamfara",
      "fct",
    ];

    const foundLocation = locationKeywords.find((loc) =>
      lowerQuery.includes(loc)
    );
    if (foundLocation) {
      searchCriteria.location = foundLocation;
    }

    // Determine intent
    let intent = "general";
    if (
      lowerQuery.includes("budget") ||
      lowerQuery.includes("price") ||
      lowerQuery.includes("₦") ||
      lowerQuery.includes("NGN")
    ) {
      intent = "budget";
    } else if (
      lowerQuery.includes("location") ||
      lowerQuery.includes("area") ||
      foundLocation
    ) {
      intent = "location";
    } else if (lowerQuery.includes("bedroom") || lowerQuery.includes("bed")) {
      intent = "search";
    }

    return {
      intent,
      searchCriteria,
      followUpQuestions: this.generateFollowUpQuestions(intent, searchCriteria),
    };
  }

  private generateFollowUpQuestions(intent: string, criteria: any): string[] {
    const questions = [];

    if (!criteria.maxPrice) {
      questions.push("What's your budget range?");
    }
    if (!criteria.bedrooms) {
      questions.push("How many bedrooms do you need?");
    }
    if (!criteria.location) {
      questions.push("Which area are you interested in?");
    }

    // Add intent-specific questions
    if (intent === "budget") {
      questions.push("Would you like to see properties in a specific area?");
    } else if (intent === "location") {
      questions.push("Do you have a preferred property type?");
    }

    return questions.slice(0, 3); // Limit to 3 questions
  }

  private async getRelevantProperties(analysis: any) {
    const criteria = analysis.searchCriteria || {};

    return await this.prisma.property.findMany({
      where: {
        ...(criteria.minPrice && { amount: { gte: criteria.minPrice } }),
        ...(criteria.maxPrice && { amount: { lte: criteria.maxPrice } }),
        ...(criteria.bedrooms && { bedrooms: criteria.bedrooms }),
        ...(criteria.location && {
          OR: [
            { city: { contains: criteria.location, mode: "insensitive" } },
            { state: { contains: criteria.location, mode: "insensitive" } },
            { address: { contains: criteria.location, mode: "insensitive" } },
          ],
        }),
        // Only show available properties
        isActive: true,
      },
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
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private async generateResponse(
    query: string,
    properties: any[],
    analysis: any
  ): Promise<AIResponse> {
    const criteria = analysis.searchCriteria;
    let answer = "";

    if (properties.length === 0) {
      answer = `I couldn't find any properties matching "${query}". `;
      if (criteria.maxPrice) {
        answer += `Try increasing your budget above ₦${criteria.maxPrice.toLocaleString()}, `;
      }
      if (criteria.location) {
        answer += `or consider nearby areas to ${criteria.location}. `;
      }
      answer += "Would you like me to suggest some alternatives?";
    } else {
      answer = `Great! I found ${properties.length} propert${
        properties.length === 1 ? "y" : "ies"
      } matching your search. `;

      if (properties.length > 0) {
        const firstProperty = properties[0];
        answer += `The top result is "${firstProperty.title}" in ${
          firstProperty.city
        } for ₦${firstProperty.amount?.toLocaleString()}`;
        if (firstProperty.bedrooms) {
          answer += ` with ${firstProperty.bedrooms} bedroom${
            firstProperty.bedrooms > 1 ? "s" : ""
          }`;
        }
        answer += ". ";
      }

      if (properties.length > 1) {
        answer += `I have ${properties.length - 1} more option${
          properties.length > 2 ? "s" : ""
        } that might interest you.`;
      }
    }

    return {
      answer,
      suggestedProperties: properties,
      followUpQuestions: analysis.followUpQuestions,
    };
  }
}

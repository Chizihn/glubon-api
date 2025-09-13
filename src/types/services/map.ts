import { Property, PropertyStatus, PropertyType, RoomType, RentalPeriod, PropertyListingType, DayOfWeek } from "@prisma/client";

export interface MapSearchResult extends Omit<Property, 'ownerId'> {
  distanceInKm: number;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    profilePic: string | null;
  };
  isLiked: boolean;
  isViewed: boolean;
  viewsCount: number;
  likesCount: number;
}

export interface MapSearchResponse {
  success: boolean;
  data?: MapSearchResult[];
  message?: string;
  total?: number;
}

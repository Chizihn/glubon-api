import { logger } from "./logger";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function getCoordinatesFromAddress(
  address: string
): Promise<Coordinates | null> {
  try {
    // TODO: Implement actual geocoding using Google Maps API
    // For now, return null - coordinates will be manually set
    logger.info(`Geocoding request for address: ${address}`);
    return null;
  } catch (error) {
    logger.warn("Failed to geocode address:", error);
    return null;
  }
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

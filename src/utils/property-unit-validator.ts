import { PrismaClient, UnitStatus, PropertyStatus } from "@prisma/client";
import { logger } from "./logger";

export class PropertyUnitValidator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validates that a property can be created with the given unit configuration
   */
  async validatePropertyCreation(input: {
    isStandalone?: boolean;
    units?: any[];
    bulkUnits?: { unitCount: number };
  }): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Standalone properties should not have multiple units
    if (input.isStandalone && input.units && input.units.length > 1) {
      errors.push("Standalone properties can only have one unit");
    }

    if (
      input.isStandalone &&
      input.bulkUnits &&
      input.bulkUnits.unitCount > 1
    ) {
      errors.push(
        "Standalone properties cannot have bulk units with count > 1"
      );
    }

    // Cannot have both individual units and bulk units
    if (input.units && input.units.length > 0 && input.bulkUnits) {
      errors.push("Cannot specify both individual units and bulk units");
    }

    // Validate bulk unit count
    if (input.bulkUnits && input.bulkUnits.unitCount > 100) {
      errors.push("Bulk unit count cannot exceed 100 units");
    }

    if (input.bulkUnits && input.bulkUnits.unitCount < 1) {
      errors.push("Bulk unit count must be at least 1");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates unit operations for booking
   */
  async validateUnitsForBooking(
    unitIds: string[]
  ): Promise<{ isValid: boolean; errors: string[]; availableUnits: string[] }> {
    const errors: string[] = [];
    const availableUnits: string[] = [];

    try {
      const units = await this.prisma.unit.findMany({
        where: { id: { in: unitIds } },
        include: {
          property: {
            select: {
              id: true,
              status: true,
              ownerId: true,
            },
          },
        },
      });

      // Check if all units exist
      if (units.length !== unitIds.length) {
        const foundIds = units.map((u) => u.id);
        const missingIds = unitIds.filter((id) => !foundIds.includes(id));
        errors.push(`Units not found: ${missingIds.join(", ")}`);
      }

      // Check unit and property status
      for (const unit of units) {
        if (unit.status !== UnitStatus.AVAILABLE) {
          errors.push(
            `Unit ${unit.id} is not available (status: ${unit.status})`
          );
        } else {
          availableUnits.push(unit.id);
        }

        if (unit.property.status !== PropertyStatus.ACTIVE) {
          errors.push(
            `Property ${unit.property.id} is not active (status: ${unit.property.status})`
          );
        }
      }

      // Check if units belong to the same property
      const propertyIds = [...new Set(units.map((u) => u.property.id))];
      if (propertyIds.length > 1) {
        errors.push(
          "All units must belong to the same property for a single booking"
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        availableUnits,
      };
    } catch (error) {
      logger.error("Error validating units for booking:", error);
      return {
        isValid: false,
        errors: ["Failed to validate units"],
        availableUnits: [],
      };
    }
  }

  /**
   * Validates property update operations
   */
  async validatePropertyUpdate(
    propertyId: string,
    ownerId: string,
    input: {
      units?: any[];
      bulkUnits?: { unitCount: number };
    }
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check property ownership and status
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, ownerId },
        include: {
          units: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!property) {
        errors.push("Property not found or access denied");
        return { isValid: false, errors };
      }

      // Check if property has rented units
      const rentedUnits = property.units.filter(
        (u) => u.status === UnitStatus.RENTED
      );

      if (input.bulkUnits && input.bulkUnits.unitCount < rentedUnits.length) {
        errors.push(
          `Cannot reduce unit count below ${rentedUnits.length} (number of rented units)`
        );
      }

      // Validate unit updates
      if (input.units) {
        for (const unitInput of input.units) {
          if (unitInput.id) {
            // Updating existing unit
            const existingUnit = property.units.find(
              (u) => u.id === unitInput.id
            );
            if (!existingUnit) {
              errors.push(`Unit ${unitInput.id} not found in this property`);
            } else if (
              existingUnit.status === UnitStatus.RENTED &&
              unitInput.status &&
              unitInput.status !== UnitStatus.RENTED
            ) {
              errors.push(
                `Cannot change status of rented unit ${unitInput.id}`
              );
            }
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error("Error validating property update:", error);
      return {
        isValid: false,
        errors: ["Failed to validate property update"],
      };
    }
  }

  /**
   * Validates unit deletion
   */
  async validateUnitDeletion(
    unitId: string,
    propertyId: string
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const unit = await this.prisma.unit.findFirst({
        where: { id: unitId, propertyId },
        include: {
          bookingUnits: {
            include: {
              booking: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!unit) {
        errors.push("Unit not found");
        return { isValid: false, errors };
      }

      // Check if unit is rented
      if (unit.status === UnitStatus.RENTED) {
        errors.push("Cannot delete a rented unit");
      }

      // Check if unit has active bookings
      const activeBookings = unit.bookingUnits.filter(
        (bu) =>
          bu.booking.status === "CONFIRMED" || bu.booking.status === "ACTIVE"
      );

      if (activeBookings.length > 0) {
        errors.push("Cannot delete unit with active bookings");
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error("Error validating unit deletion:", error);
      return {
        isValid: false,
        errors: ["Failed to validate unit deletion"],
      };
    }
  }

  /**
   * Ensures property unit counts are consistent
   */
  async validateAndFixPropertyUnitCounts(propertyId: string): Promise<void> {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        include: {
          units: {
            select: {
              status: true,
            },
          },
        },
      });

      if (!property) return;

      const totalUnits = property.units.length;
      const availableUnits = property.units.filter(
        (u) => u.status === UnitStatus.AVAILABLE
      ).length;

      // Update if counts are inconsistent
      if (
        property.totalUnits !== totalUnits ||
        property.availableUnits !== availableUnits
      ) {
        await this.prisma.property.update({
          where: { id: propertyId },
          data: {
            totalUnits,
            availableUnits,
          },
        });

        logger.info(
          `Fixed unit counts for property ${propertyId}: total=${totalUnits}, available=${availableUnits}`
        );
      }
    } catch (error) {
      logger.error(
        `Error validating unit counts for property ${propertyId}:`,
        error
      );
    }
  }

  /**
   * Batch validation for multiple properties
   */
  async batchValidatePropertyUnitCounts(propertyIds: string[]): Promise<void> {
    for (const propertyId of propertyIds) {
      await this.validateAndFixPropertyUnitCounts(propertyId);
    }
  }
}

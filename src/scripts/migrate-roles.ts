
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting data migration...");

  const users = await prisma.user.findMany({
    where: {
      roles: {
        equals: [ "RENTER" ] // Default value
      }
    }
  });

  console.log(`Found ${users.length} users to check.`);

  for (const user of users) {
    // If roles is default but role is something else, or if we just want to ensure sync
    if (user.role) {
        console.log(`Migrating user ${user.email}: ${user.role} -> [${user.role}]`);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                roles: [user.role]
            }
        });
    }
  }

  console.log("Data migration completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

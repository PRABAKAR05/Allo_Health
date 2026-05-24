import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing broken image URL for Dyson...");
  
  await prisma.product.updateMany({
    where: {
      sku: "HOME-DYS-V15"
    },
    data: {
      // New working image URL for a vacuum cleaner
      imageUrl: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=800&q=80"
    }
  });

  console.log("✅ Image URL updated successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

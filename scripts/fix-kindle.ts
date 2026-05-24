import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing Kindle image (using Unsplash since Amazon blocked hotlinking)...");
  
  await prisma.product.updateMany({
    where: { sku: "ELEC-AMZN-KPW" },
    data: { imageUrl: "https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=800&q=80" }
  });

  console.log("✅ Kindle image updated successfully!");
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

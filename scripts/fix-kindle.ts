import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing Kindle image...");
  
  await prisma.product.updateMany({
    where: { sku: "ELEC-AMZN-KPW" },
    data: { imageUrl: "https://m.media-amazon.com/images/I/51r2L-pC3cL._AC_SX679_.jpg" }
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

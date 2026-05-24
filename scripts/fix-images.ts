import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updates = [
  {
    sku: "HOME-IP-DUO7", // Instant Pot
    imageUrl: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=800&q=80"
  },
  {
    sku: "ELEC-AMZN-KPW", // Kindle
    imageUrl: "https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=800&q=80"
  },
  {
    sku: "APRL-LEVI-501", // Jeans
    imageUrl: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80"
  },
  {
    sku: "SHOE-NIKE-AM270", // Nike
    imageUrl: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&q=80"
  }
];

async function main() {
  console.log("Fixing images...");
  
  for (const update of updates) {
    await prisma.product.updateMany({
      where: { sku: update.sku },
      data: { imageUrl: update.imageUrl }
    });
    console.log(`Updated ${update.sku}`);
  }

  console.log("✅ All images updated successfully!");
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

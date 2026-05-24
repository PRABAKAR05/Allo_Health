import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const updates = [
  {
    sku: "HOME-IP-DUO7",
    imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcR5jcwZEW78QgKHVTj0BcvFzSbQIOzsIT4V3m0ilEcIY0STReFXJkXUKzFh7mHoeUbpbfVoYByjqw-JZDWxwwm9V3sEhWrLQ6402EvHF3VQ_1nDPA50d-1sCA"
  },
  {
    sku: "ELEC-AMZN-KPW",
    // Used a direct image URL because the GamLoot link was a webpage
    imageUrl: "https://sell.gameloot.in/wp-content/uploads/2021/08/Amazon-Kindle-Paperwhite-4-10th-Gen-8-GB-6-Inch-WiFi-Only-Black-1.jpg"
  },
  {
    sku: "APRL-LEVI-501",
    imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcS_4YTIWxv9jaPmQbCT9bexuR0N9ZDc2EFDIAr3HutuvALjaIYNFCkskQQKydskTxJs8kf8wc2kqItlZe8GprN8CR-u2fDvea8t6Y-T8NFHtJn3SULKo07V"
  },
  {
    sku: "ELEC-MAC-14M3",
    imageUrl: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRMzmVawd9QY7mBosKPBZkfd_syM6fUClfcLmzFF8uHbxDLLpU"
  }
];

async function main() {
  console.log("Fixing user-provided images...");
  
  for (const update of updates) {
    await prisma.product.updateMany({
      where: { sku: update.sku },
      data: { imageUrl: update.imageUrl }
    });
    console.log(`Updated ${update.sku}`);
  }

  console.log("✅ All user-provided images updated successfully!");
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

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  console.log("✓ Cleared existing data\n");

  // Create Warehouses
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi NCR Hub",
        location: "Gurugram, Haryana",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Bangalore South",
        location: "Bengaluru, Karnataka",
      },
    }),
  ]);

  console.log(`✓ Created ${warehouses.length} warehouses`);

  // Create Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "MacBook Pro 14″ M3",
        sku: "ELEC-MBP14-M3",
        description:
          "Apple MacBook Pro 14-inch with M3 Pro chip, 18GB RAM, 512GB SSD. Space Black finish with Liquid Retina XDR display.",
        imageUrl: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
        price: 169900,
      },
    }),
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5",
        sku: "ELEC-SONY-XM5",
        description:
          "Industry-leading noise canceling headphones with Auto NC Optimizer, crystal-clear hands-free calling, and 30-hour battery life.",
        imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80",
        price: 26990,
      },
    }),
    prisma.product.create({
      data: {
        name: "Nike Air Max 270",
        sku: "SHOE-NIKE-AM270",
        description:
          "The Nike Air Max 270 delivers visible air cushioning under every step. Updated for the modern era with a sleek design and lightweight feel.",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
        price: 12995,
      },
    }),
    prisma.product.create({
      data: {
        name: "Dyson V15 Detect",
        sku: "HOME-DYS-V15",
        description:
          "Dyson's most powerful cordless vacuum with laser dust detection, piezo sensor, and LCD screen showing real-time particle counts.",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80",
        price: 62900,
      },
    }),
    prisma.product.create({
      data: {
        name: "Samsung Galaxy S24 Ultra",
        sku: "PHONE-SAM-S24U",
        description:
          "Galaxy AI is here. 200MP camera, titanium design, built-in S Pen, and Snapdragon 8 Gen 3 processor for ultimate mobile performance.",
        imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80",
        price: 129999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Levi's 501 Original Jeans",
        sku: "APRL-LEVI-501",
        description:
          "The original blue jean since 1873. Straight leg, button fly, and that iconic Levi's fit that's been trusted for over 150 years.",
        imageUrl: "https://images.unsplash.com/photo-1542272454315-4c01d7abdf4a?w=800&q=80",
        price: 3999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Kindle Paperwhite",
        sku: "ELEC-AMZN-KPW",
        description:
          "The thinnest, lightest Kindle Paperwhite yet, with a flush-front design and 300ppi glare-free display. Waterproof and USB-C.",
        imageUrl: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=800&q=80",
        price: 14999,
      },
    }),
    prisma.product.create({
      data: {
        name: "Instant Pot Duo 7-in-1",
        sku: "HOME-IP-DUO7",
        description:
          "7-in-1 programmable cooker: pressure cook, slow cook, rice cook, steam, sauté, yogurt make, and warm. 6 quart capacity.",
        imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
        price: 8999,
      },
    }),
  ]);

  console.log(`✓ Created ${products.length} products`);

  // Create Inventory Items (stock per product per warehouse)
  // Varying stock levels to make the demo interesting
  const stockConfig: { productIndex: number; warehouseIndex: number; stock: number }[] = [
    // MacBook Pro - limited stock (high value)
    { productIndex: 0, warehouseIndex: 0, stock: 5 },
    { productIndex: 0, warehouseIndex: 1, stock: 3 },
    { productIndex: 0, warehouseIndex: 2, stock: 8 },

    // Sony headphones - moderate stock
    { productIndex: 1, warehouseIndex: 0, stock: 25 },
    { productIndex: 1, warehouseIndex: 1, stock: 18 },
    { productIndex: 1, warehouseIndex: 2, stock: 30 },

    // Nike shoes - high stock
    { productIndex: 2, warehouseIndex: 0, stock: 50 },
    { productIndex: 2, warehouseIndex: 1, stock: 42 },
    { productIndex: 2, warehouseIndex: 2, stock: 35 },

    // Dyson vacuum - limited
    { productIndex: 3, warehouseIndex: 0, stock: 2 },
    { productIndex: 3, warehouseIndex: 1, stock: 7 },
    { productIndex: 3, warehouseIndex: 2, stock: 4 },

    // Samsung phone - moderate
    { productIndex: 4, warehouseIndex: 0, stock: 12 },
    { productIndex: 4, warehouseIndex: 1, stock: 15 },
    { productIndex: 4, warehouseIndex: 2, stock: 9 },

    // Levi's jeans - high stock
    { productIndex: 5, warehouseIndex: 0, stock: 100 },
    { productIndex: 5, warehouseIndex: 1, stock: 75 },
    { productIndex: 5, warehouseIndex: 2, stock: 60 },

    // Kindle - moderate
    { productIndex: 6, warehouseIndex: 0, stock: 20 },
    { productIndex: 6, warehouseIndex: 1, stock: 15 },
    { productIndex: 6, warehouseIndex: 2, stock: 22 },

    // Instant Pot - some warehouses low
    { productIndex: 7, warehouseIndex: 0, stock: 8 },
    { productIndex: 7, warehouseIndex: 1, stock: 1 },
    { productIndex: 7, warehouseIndex: 2, stock: 14 },
  ];

  const inventoryItems = await Promise.all(
    stockConfig.map(({ productIndex, warehouseIndex, stock }) =>
      prisma.inventoryItem.create({
        data: {
          productId: products[productIndex].id,
          warehouseId: warehouses[warehouseIndex].id,
          totalStock: stock,
          reservedStock: 0,
        },
      })
    )
  );

  console.log(`✓ Created ${inventoryItems.length} inventory entries\n`);

  // Summary
  console.log("📊 Seed Summary:");
  console.log("━".repeat(50));
  for (const product of products) {
    const items = inventoryItems.filter((i) =>
      stockConfig.find(
        (sc) =>
          products[sc.productIndex].id === product.id &&
          warehouses[sc.warehouseIndex].id === i.warehouseId
      )
    );
    const totalStock = stockConfig
      .filter((sc) => products[sc.productIndex].id === product.id)
      .reduce((sum, sc) => sum + sc.stock, 0);

    console.log(`  ${product.name} (${product.sku}): ${totalStock} total units`);
  }
  console.log("━".repeat(50));
  console.log("\n✅ Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

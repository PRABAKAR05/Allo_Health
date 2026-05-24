/**
 * Concurrency Test Script
 * 
 * Fires N simultaneous reservation requests for a product with limited stock.
 * Verifies that exactly the expected number succeed and the rest get 409.
 * 
 * Usage:
 *   npx tsx scripts/test-concurrency.ts
 * 
 * Make sure the dev server is running at http://localhost:3000
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function main() {
  console.log("🧪 Concurrency Test\n");
  console.log(`Target: ${BASE_URL}\n`);

  // Step 1: Get products to find one with low stock
  const productsRes = await fetch(`${BASE_URL}/api/products`);
  const products = await productsRes.json();

  if (!products.length) {
    console.error("❌ No products found. Run the seed script first.");
    process.exit(1);
  }

  // Find a warehouse with low stock (ideally 1-3 units)
  let targetProduct = null;
  let targetWarehouse = null;

  for (const product of products) {
    for (const wh of product.warehouses) {
      if (wh.availableStock >= 1 && wh.availableStock <= 5) {
        targetProduct = product;
        targetWarehouse = wh;
        break;
      }
    }
    if (targetProduct) break;
  }

  if (!targetProduct || !targetWarehouse) {
    // Fallback to first product with any stock
    targetProduct = products[0];
    targetWarehouse = products[0].warehouses[0];
  }

  const availableStock = targetWarehouse.availableStock;
  const concurrentRequests = availableStock + 5; // More requests than stock

  console.log(`📦 Product: ${targetProduct.name}`);
  console.log(`🏭 Warehouse: ${targetWarehouse.warehouseName}`);
  console.log(`📊 Available Stock: ${availableStock}`);
  console.log(`🚀 Sending ${concurrentRequests} concurrent requests for 1 unit each\n`);
  console.log("Expected: exactly " + availableStock + " succeed (201), " + (concurrentRequests - availableStock) + " fail (409)\n");
  console.log("━".repeat(60));

  // Step 2: Fire concurrent requests
  const requests = Array.from({ length: concurrentRequests }, (_, i) =>
    fetch(`${BASE_URL}/api/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: targetProduct.id,
        warehouseId: targetWarehouse.warehouseId,
        quantity: 1,
      }),
    }).then(async (res) => {
      const body = await res.json();
      return { index: i, status: res.status, body };
    })
  );

  const results = await Promise.all(requests);

  // Step 3: Analyze results
  const successes = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const errors = results.filter((r) => r.status !== 201 && r.status !== 409);

  console.log("\n📊 Results:");
  console.log(`  ✅ 201 (Created):  ${successes.length}`);
  console.log(`  ⚠️  409 (Conflict): ${conflicts.length}`);
  if (errors.length > 0) {
    console.log(`  ❌ Other errors:   ${errors.length}`);
    errors.forEach((e) => console.log(`     Request #${e.index}: ${e.status} - ${JSON.stringify(e.body)}`));
  }
  console.log("━".repeat(60));

  // Step 4: Verify correctness
  if (successes.length === availableStock && conflicts.length === concurrentRequests - availableStock) {
    console.log("\n✅ PASS: Concurrency control is working correctly!");
    console.log(`   Exactly ${availableStock} reservations succeeded out of ${concurrentRequests} attempts.`);
  } else {
    console.log("\n❌ FAIL: Unexpected results!");
    console.log(`   Expected ${availableStock} successes, got ${successes.length}`);
    console.log(`   Expected ${concurrentRequests - availableStock} conflicts, got ${conflicts.length}`);
  }

  // Step 5: Clean up - release the reservations we created
  console.log("\n🧹 Cleaning up: releasing test reservations...");
  for (const success of successes) {
    try {
      await fetch(`${BASE_URL}/api/reservations/${success.body.id}/release`, {
        method: "POST",
      });
    } catch {
      // ignore cleanup errors
    }
  }
  console.log("✓ Cleanup complete\n");
}

main().catch(console.error);

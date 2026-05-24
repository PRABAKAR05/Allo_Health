import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lazy cleanup: expire any stale pending reservations on read
    const now = new Date();
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
    });

    if (expiredReservations.length > 0) {
      // Release reserved stock for each expired reservation
      for (const reservation of expiredReservations) {
        await prisma.$transaction([
          prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: "EXPIRED" },
          }),
          prisma.inventoryItem.updateMany({
            where: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
            data: {
              reservedStock: { decrement: reservation.quantity },
            },
          }),
        ]);
      }
    }

    const products = await prisma.product.findMany({
      include: {
        inventoryItems: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const productsWithAvailability = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      imageUrl: product.imageUrl,
      price: product.price,
      warehouses: product.inventoryItems.map((item) => ({
        warehouseId: item.warehouseId,
        warehouseName: item.warehouse.name,
        warehouseLocation: item.warehouse.location,
        totalStock: item.totalStock,
        reservedStock: item.reservedStock,
        availableStock: item.totalStock - item.reservedStock,
      })),
    }));

    return NextResponse.json(productsWithAvailability);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Cron job endpoint to expire stale reservations.
 * Secured with CRON_SECRET to prevent unauthorized access.
 * 
 * This runs every minute via Vercel Cron (configured in vercel.json).
 * It finds all PENDING reservations whose expiresAt has passed,
 * releases their reserved stock, and marks them as EXPIRED.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({ message: "No expired reservations found", count: 0 });
    }

    // Process each expired reservation
    let expiredCount = 0;
    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction([
          prisma.reservation.update({
            where: { id: reservation.id, status: "PENDING" },
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
        expiredCount++;
      } catch (err) {
        // If a reservation was already expired/released by another process, skip it
        console.error(`Failed to expire reservation ${reservation.id}:`, err);
      }
    }

    return NextResponse.json({
      message: `Expired ${expiredCount} reservations`,
      count: expiredCount,
    });
  } catch (error) {
    console.error("Error in cron job:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}

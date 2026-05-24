import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkIdempotencyKey, cacheIdempotencyResponse } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // --- Idempotency Check (Bonus) ---
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const { exists, cachedResponse } = await checkIdempotencyKey(idempotencyKey);
      if (exists && cachedResponse) {
        return NextResponse.json(cachedResponse.body, {
          status: cachedResponse.status,
        });
      }
    }

    // Fetch the reservation
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, sku: true, price: true } },
        warehouse: { select: { name: true, location: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Already confirmed — idempotent response
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json({
        id: reservation.id,
        status: "CONFIRMED",
        message: "Reservation was already confirmed",
        product: reservation.product,
        warehouse: reservation.warehouse,
        quantity: reservation.quantity,
      });
    }

    // Check if released or expired
    if (reservation.status === "RELEASED" || reservation.status === "EXPIRED") {
      return NextResponse.json(
        {
          error: "Reservation is no longer active",
          status: reservation.status,
          message: `This reservation was ${reservation.status.toLowerCase()}`,
        },
        { status: 410 }
      );
    }

    // Check if expired by time (lazy check)
    if (reservation.expiresAt < new Date()) {
      // Expire it now
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
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

      const errorResponse = {
        error: "Reservation has expired",
        message:
          "The reservation window has passed. The units have been released back to available stock. Please create a new reservation.",
      };

      return NextResponse.json(errorResponse, { status: 410 });
    }

    // --- Confirm the reservation ---
    // In a transaction:
    // 1. Set status to CONFIRMED
    // 2. Decrement totalStock (permanent sale)
    // 3. Decrement reservedStock (hold is released)
    const confirmed = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      }),
      prisma.inventoryItem.updateMany({
        where: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
        data: {
          totalStock: { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity },
        },
      }),
    ]);

    const successResponse = {
      id: confirmed[0].id,
      status: "CONFIRMED",
      message: "Payment confirmed. Stock has been permanently allocated.",
      product: reservation.product,
      warehouse: reservation.warehouse,
      quantity: reservation.quantity,
      confirmedAt: confirmed[0].updatedAt.toISOString(),
    };

    // Cache response for idempotency
    if (idempotencyKey) {
      await cacheIdempotencyResponse(idempotencyKey, 200, successResponse);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("Error confirming reservation:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Already released — idempotent response
    if (reservation.status === "RELEASED") {
      return NextResponse.json({
        id: reservation.id,
        status: "RELEASED",
        message: "Reservation was already released",
      });
    }

    // Already confirmed — can't release
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(
        {
          error: "Cannot release a confirmed reservation",
          message: "This reservation has already been confirmed and paid for.",
        },
        { status: 400 }
      );
    }

    // Already expired
    if (reservation.status === "EXPIRED") {
      return NextResponse.json({
        id: reservation.id,
        status: "EXPIRED",
        message: "Reservation had already expired",
      });
    }

    // --- Release the reservation ---
    // In a transaction:
    // 1. Set status to RELEASED
    // 2. Decrement reservedStock (units return to available pool)
    const released = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
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

    return NextResponse.json({
      id: released[0].id,
      status: "RELEASED",
      message: "Reservation cancelled. Units have been returned to available stock.",
      product: reservation.product,
      warehouse: reservation.warehouse,
      quantity: reservation.quantity,
    });
  } catch (error) {
    console.error("Error releasing reservation:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}

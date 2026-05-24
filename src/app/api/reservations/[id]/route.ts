import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: {
          select: { name: true, sku: true, price: true, imageUrl: true },
        },
        warehouse: { select: { name: true, location: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // Lazy expiry check
    if (
      reservation.status === "PENDING" &&
      reservation.expiresAt < new Date()
    ) {
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

      return NextResponse.json({
        ...reservation,
        status: "EXPIRED",
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ...reservation,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error fetching reservation:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}

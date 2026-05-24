import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reserveSchema } from "@/lib/validations";
import {
  checkIdempotencyKey,
  cacheIdempotencyResponse,
} from "@/lib/idempotency";

export const dynamic = "force-dynamic";

const RESERVATION_TTL_MINUTES = parseInt(
  process.env.RESERVATION_TTL_MINUTES || "10",
  10
);

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parsed = reserveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // --- Idempotency Check (Bonus) ---
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      const { exists, cachedResponse } =
        await checkIdempotencyKey(idempotencyKey);
      if (exists && cachedResponse) {
        return NextResponse.json(cachedResponse.body, {
          status: cachedResponse.status,
        });
      }
    }

    // --- Core Concurrency Logic ---
    // Atomic conditional UPDATE: only succeeds if enough stock is available.
    // PostgreSQL acquires a row-level lock during UPDATE, making this race-condition-free.
    // If two requests arrive for the last unit simultaneously:
    //   1. First request locks the row, updates reservedStock.
    //   2. Second request waits for lock, then re-evaluates WHERE clause with new data.
    //   3. WHERE fails (not enough stock) → count = 0 → 409 returned.
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Atomic stock reservation using raw SQL for precise control
      const updated = await tx.$executeRaw`
        UPDATE "InventoryItem"
        SET "reservedStock" = "reservedStock" + ${quantity},
            "updatedAt" = NOW()
        WHERE "productId" = ${productId}
          AND "warehouseId" = ${warehouseId}
          AND ("totalStock" - "reservedStock") >= ${quantity}
      `;

      if (updated === 0) {
        return null; // Not enough stock
      }

      // Step 2: Create the reservation record
      const expiresAt = new Date(
        Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
      );

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "PENDING",
          expiresAt,
          idempotencyKey: idempotencyKey || undefined,
        },
        include: {
          product: { select: { name: true, sku: true, price: true } },
          warehouse: { select: { name: true, location: true } },
        },
      });

      return reservation;
    });

    if (!result) {
      const errorResponse = {
        error: "Insufficient stock available",
        message:
          "The requested quantity is not available at this warehouse. Another customer may have reserved the last units.",
      };

      // Cache the 409 response for idempotency
      if (idempotencyKey) {
        await cacheIdempotencyResponse(idempotencyKey, 409, errorResponse);
      }

      return NextResponse.json(errorResponse, { status: 409 });
    }

    const successResponse = {
      id: result.id,
      productId: result.productId,
      warehouseId: result.warehouseId,
      quantity: result.quantity,
      status: result.status,
      expiresAt: result.expiresAt.toISOString(),
      product: result.product,
      warehouse: result.warehouse,
      createdAt: result.createdAt.toISOString(),
    };

    // Cache the success response for idempotency
    if (idempotencyKey) {
      await cacheIdempotencyResponse(
        idempotencyKey,
        201,
        successResponse,
        RESERVATION_TTL_MINUTES * 60
      );
    }

    return NextResponse.json(successResponse, { status: 201 });
  } catch (error) {
    console.error("Error creating reservation:", error);

    // Handle unique constraint violation on idempotencyKey
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "Duplicate idempotency key" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}

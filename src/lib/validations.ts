import { z } from "zod";

export const reserveSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  warehouseId: z.string().uuid("Invalid warehouse ID"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1")
    .max(100, "Maximum 100 units per reservation"),
});

export const reservationIdSchema = z.object({
  id: z.string().uuid("Invalid reservation ID"),
});

export type ReserveInput = z.infer<typeof reserveSchema>;
export type ReservationIdInput = z.infer<typeof reservationIdSchema>;

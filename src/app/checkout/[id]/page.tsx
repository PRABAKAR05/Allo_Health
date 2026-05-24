"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: {
    name: string;
    sku: string;
    price: number;
    imageUrl: string;
  };
  warehouse: {
    name: string;
    location: string;
  };
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    title: string;
    message: string;
    statusCode?: number;
  } | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setError("Reservation not found");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch reservation");
      const data = await res.json();
      setReservation(data);
    } catch {
      setError("Failed to load reservation details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  // Countdown timer
  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    const updateTimer = () => {
      const now = Date.now();
      const expires = new Date(reservation.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(remaining);

      // Auto-expire on client side
      if (remaining === 0) {
        setReservation((prev) =>
          prev ? { ...prev, status: "EXPIRED" } : null
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [reservation]);

  const handleConfirm = async () => {
    setConfirming(true);
    setActionResult(null);

    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.status === 410) {
        setActionResult({
          type: "error",
          title: "Reservation Expired",
          message: data.message || "The reservation window has passed.",
          statusCode: 410,
        });
        setReservation((prev) =>
          prev ? { ...prev, status: "EXPIRED" } : null
        );
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm");
      }

      setActionResult({
        type: "success",
        title: "Purchase Confirmed! 🎉",
        message: "Payment successful. Your order has been placed.",
      });
      setReservation((prev) =>
        prev ? { ...prev, status: "CONFIRMED" } : null
      );
    } catch (err) {
      setActionResult({
        type: "error",
        title: "Confirmation Failed",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleRelease = async () => {
    setReleasing(true);
    setActionResult(null);

    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel");
      }

      setActionResult({
        type: "success",
        title: "Reservation Cancelled",
        message: "Units have been returned to available stock.",
      });
      setReservation((prev) =>
        prev ? { ...prev, status: "RELEASED" } : null
      );
    } catch (err) {
      setActionResult({
        type: "error",
        title: "Cancellation Failed",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setReleasing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getTimerClass = () => {
    if (timeLeft === 0) return "timer-expired";
    if (timeLeft <= 60) return "timer-urgent";
    if (timeLeft <= 180) return "timer-warning";
    return "timer-active";
  };

  const getStatusClass = (status: string) => {
    return `status-badge status-${status.toLowerCase()}`;
  };

  if (loading) {
    return (
      <div className="checkout-container">
        <div className="checkout-card">
          <div className="checkout-header">
            <div className="skeleton" style={{ height: 28, width: "60%", margin: "0 auto 8px" }} />
            <div className="skeleton" style={{ height: 18, width: "40%", margin: "0 auto" }} />
          </div>
          <div className="checkout-body">
            <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
            <div className="skeleton" style={{ height: 200 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="checkout-container">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>{error || "Reservation not found"}</h3>
          <p>This reservation may have been deleted or the link is invalid.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "1rem" }}
            onClick={() => router.push("/")}
          >
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING" && timeLeft > 0;
  const isFinalized = ["CONFIRMED", "RELEASED", "EXPIRED"].includes(reservation.status) || timeLeft === 0;

  return (
    <div className="checkout-container">
      {/* Action Result Banner */}
      {actionResult && (
        <div
          className={`error-banner ${
            actionResult.statusCode === 409
              ? "error-banner-409"
              : actionResult.statusCode === 410
              ? "error-banner-410"
              : actionResult.type === "error"
              ? "error-banner-410"
              : ""
          }`}
          style={
            actionResult.type === "success"
              ? {
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.15)",
                }
              : undefined
          }
        >
          <span className="error-banner-icon">
            {actionResult.type === "success" ? "✅" : actionResult.statusCode === 410 ? "⏰" : "❌"}
          </span>
          <div className="error-banner-content">
            <h3>{actionResult.title}</h3>
            <p>{actionResult.message}</p>
          </div>
        </div>
      )}

      <div className="checkout-card">
        <div className="checkout-header">
          <h1>Checkout</h1>
          <p>
            Reservation{" "}
            <span style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
              #{id.slice(0, 8)}
            </span>
          </p>
        </div>

        <div className="checkout-body">
          {/* Status */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <span className={getStatusClass(reservation.status)}>
              {reservation.status === "PENDING" && timeLeft === 0 ? "EXPIRED" : reservation.status}
            </span>
          </div>

          {/* Timer (only for PENDING) */}
          {reservation.status === "PENDING" && (
            <>
              <div className={`timer ${getTimerClass()}`}>
                {timeLeft > 0 ? (
                  <>⏱ {formatTime(timeLeft)}</>
                ) : (
                  <>⏰ Expired</>
                )}
              </div>
              <div className="timer-label" style={{ color: timeLeft <= 60 ? "var(--danger)" : "var(--text-muted)" }}>
                {timeLeft > 0
                  ? "Time remaining to complete purchase"
                  : "Reservation has expired — units returned to stock"}
              </div>
            </>
          )}

          {/* Reservation Details */}
          <div className="info-row">
            <span className="info-label">Product</span>
            <span className="info-value">{reservation.product.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">SKU</span>
            <span className="info-value" style={{ fontFamily: "monospace" }}>
              {reservation.product.sku}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Warehouse</span>
            <span className="info-value">{reservation.warehouse.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Location</span>
            <span className="info-value">{reservation.warehouse.location}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Quantity</span>
            <span className="info-value">{reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Unit Price</span>
            <span className="info-value">₹{reservation.product.price.toLocaleString()}</span>
          </div>

          <div className="divider" />

          <div className="info-row">
            <span className="info-label" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Total Amount
            </span>
            <span className="info-value" style={{ fontSize: "1.5rem", color: "var(--accent)" }}>
              ₹{(reservation.product.price * reservation.quantity).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="checkout-actions">
          {isPending ? (
            <>
              <button
                className="btn btn-danger btn-lg"
                onClick={handleRelease}
                disabled={releasing || confirming}
                style={{ flex: 1 }}
              >
                {releasing ? "Cancelling..." : "Cancel"}
              </button>
              <button
                className="btn btn-success btn-lg"
                onClick={handleConfirm}
                disabled={confirming || releasing}
                style={{ flex: 2 }}
              >
                {confirming ? (
                  <>
                    <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderTopColor: "white" }} />
                    Processing...
                  </>
                ) : (
                  "✓ Confirm Purchase"
                )}
              </button>
            </>
          ) : (
            <button
              className="btn btn-ghost btn-lg btn-full"
              onClick={() => router.push("/")}
            >
              {isFinalized ? "← Back to Products" : "← Back to Products"}
            </button>
          )}
        </div>
      </div>

      {/* Created timestamp */}
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Reserved on {new Date(reservation.createdAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

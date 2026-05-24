"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface WarehouseStock {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  imageUrl: string;
  price: number;
  warehouses: WarehouseStock[];
}

interface ReserveModalState {
  product: Product;
  warehouse: WarehouseStock;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reserveModal, setReserveModal] = useState<ReserveModalState | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const router = useRouter();

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    // Poll every 15 seconds for stock updates
    const interval = setInterval(fetchProducts, 15000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleReserve = async () => {
    if (!reserveModal) return;
    setReserving(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: reserveModal.product.id,
          warehouseId: reserveModal.warehouse.warehouseId,
          quantity,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setToast({
          type: "error",
          message: data.error || "Insufficient stock available",
        });
        setReserveModal(null);
        fetchProducts();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Failed to reserve");
      }

      setReserveModal(null);
      setToast({
        type: "success",
        message: "Reservation created! Redirecting to checkout...",
      });

      // Navigate to checkout page
      setTimeout(() => {
        router.push(`/checkout/${data.id}`);
      }, 1000);
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reserve",
      });
    } finally {
      setReserving(false);
    }
  };

  const getStockClass = (available: number) => {
    if (available === 0) return "stock-zero";
    if (available <= 5) return "stock-low";
    if (available <= 20) return "stock-medium";
    return "stock-high";
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-hero">
          <h1>Product Catalog</h1>
          <p>Browse inventory across all warehouses</p>
        </div>
        <div className="product-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="product-card">
              <div className="skeleton" style={{ height: 200 }} />
              <div className="product-card-body">
                <div className="skeleton" style={{ height: 24, width: "70%", marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 16, width: "40%", marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 60 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h3>{error}</h3>
          <p>Please try refreshing the page.</p>
          <button className="btn btn-primary" style={{ marginTop: "1rem" }} onClick={fetchProducts}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-hero">
        <h1>Product Catalog</h1>
        <p>Real-time inventory across all warehouses. Reserve units to hold them during checkout.</p>
      </div>

      {products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <h3>No products found</h3>
          <p>The catalog is empty. Run the seed script to populate products.</p>
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-card-image">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} />
                ) : (
                  <span className="product-card-image-placeholder">📦</span>
                )}
              </div>
              <div className="product-card-body">
                <div className="product-card-header">
                  <div>
                    <div className="product-card-name">{product.name}</div>
                    <div className="product-card-sku">SKU: {product.sku}</div>
                  </div>
                  <div className="product-card-price">
                    ₹{product.price.toLocaleString()}
                  </div>
                </div>
                <div className="product-card-desc">{product.description}</div>

                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Warehouse</th>
                      <th>Available</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.warehouses.map((wh) => (
                      <tr key={wh.warehouseId}>
                        <td>
                          <div className="warehouse-name">{wh.warehouseName}</div>
                          <div className="warehouse-location">{wh.warehouseLocation}</div>
                        </td>
                        <td>
                          <span className={`stock-badge ${getStockClass(wh.availableStock)}`}>
                            <span className="stock-badge-dot" />
                            {wh.availableStock} units
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-reserve"
                            disabled={wh.availableStock === 0}
                            onClick={() => {
                              setReserveModal({ product, warehouse: wh });
                              setQuantity(1);
                            }}
                          >
                            {wh.availableStock === 0 ? "Out of stock" : "Reserve"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reserve Modal */}
      {reserveModal && (
        <div className="modal-overlay" onClick={() => !reserving && setReserveModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Reserve Units</div>
              <button
                className="modal-close"
                onClick={() => !reserving && setReserveModal(null)}
                disabled={reserving}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="info-row">
                <span className="info-label">Product</span>
                <span className="info-value">{reserveModal.product.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">SKU</span>
                <span className="info-value" style={{ fontFamily: "monospace" }}>
                  {reserveModal.product.sku}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Warehouse</span>
                <span className="info-value">{reserveModal.warehouse.warehouseName}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Available</span>
                <span className="info-value">
                  {reserveModal.warehouse.availableStock} units
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Unit Price</span>
                <span className="info-value">
                  ₹{reserveModal.product.price.toLocaleString()}
                </span>
              </div>

              <div className="divider" />

              <div className="form-group">
                <label className="form-label" htmlFor="quantity">
                  Quantity
                </label>
                <input
                  id="quantity"
                  type="number"
                  className="form-input"
                  min={1}
                  max={Math.min(reserveModal.warehouse.availableStock, 100)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <div className="form-hint">
                  Max: {Math.min(reserveModal.warehouse.availableStock, 100)} units.
                  Reserved for 10 minutes.
                </div>
              </div>

              <div className="info-row" style={{ paddingTop: "0.75rem", borderTop: `1px solid var(--surface-border)` }}>
                <span className="info-label" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Total
                </span>
                <span className="info-value" style={{ fontSize: "1.25rem", color: "var(--accent)" }}>
                  ₹{(reserveModal.product.price * quantity).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => setReserveModal(null)}
                disabled={reserving}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleReserve}
                disabled={
                  reserving ||
                  quantity < 1 ||
                  quantity > reserveModal.warehouse.availableStock
                }
                style={{ flex: 2 }}
              >
                {reserving ? (
                  <>
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Reserving...
                  </>
                ) : (
                  `Reserve ${quantity} unit${quantity > 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span>
              {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
            </span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

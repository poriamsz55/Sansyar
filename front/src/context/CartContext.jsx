import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  getStoreCart,
  addStoreCartItem,
  updateStoreCartItem,
  removeStoreCartItem,
  clearStoreCart,
} from "../api/endpoints";

const CartContext = createContext(null);

const emptyCart = { items: [], item_count: 0, subtotal: 0, total: 0, has_issues: false };

/**
 * Store cart state shared by the product page (add), the header badge
 * (count) and the cart page (everything). The server is the single source
 * of truth for prices and totals — this context only caches its view.
 */
export function CartProvider({ children }) {
  const [cart, setCart] = useState(emptyCart);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const view = await getStoreCart();
      setCart(view || emptyCart);
    } catch {
      // Cart failures (e.g. API offline) must not break browsing; keep the
      // last known state and let the cart page surface errors.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async ({ variantId, qty }) => {
      const view = await addStoreCartItem({ variantId, qty });
      setCart(view || emptyCart);
      return view;
    },
    []
  );

  const updateQty = useCallback(async (variantId, qty) => {
    const view = await updateStoreCartItem(variantId, qty);
    setCart(view || emptyCart);
    return view;
  }, []);

  const removeItem = useCallback(async (variantId) => {
    const view = await removeStoreCartItem(variantId);
    setCart(view || emptyCart);
    return view;
  }, []);

  const clear = useCallback(async () => {
    const view = await clearStoreCart();
    setCart(view || emptyCart);
    return view;
  }, []);

  return (
    <CartContext.Provider
      value={{ cart, ready, refresh, addItem, updateQty, removeItem, clearCart: clear }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

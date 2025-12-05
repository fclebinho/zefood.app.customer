import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CartItem, MenuItem, Restaurant } from '../types';

interface CartContextType {
  items: CartItem[];
  restaurant: Restaurant | null;
  addItem: (item: MenuItem, restaurant: Restaurant, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  const addItem = (item: MenuItem, rest: Restaurant, quantity = 1) => {
    if (restaurant && restaurant.id !== rest.id) {
      setItems([]);
    }
    setRestaurant(rest);

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.menuItem.id === item.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prev, { menuItem: item, quantity }];
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.menuItem.id === itemId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    setRestaurant(null);
  };

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
    0
  );

  const deliveryFee = restaurant ? Number(restaurant.deliveryFee) : 0;
  const total = subtotal + deliveryFee;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        restaurant,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        deliveryFee,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

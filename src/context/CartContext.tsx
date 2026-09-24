'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  origin: string;
  image: string;
  price: number;
  priceOld?: number;
  length?: string;
  color?: string;
  quantity: number;
}

export interface CupomAplicado {
  codigo: string;
  descontoPercent: number;
  escopo: 'todos' | 'marca' | 'produtos';
  marca: string | null;
  produtos: string[];
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (id: string, length?: string, color?: string) => void;
  updateQuantity: (id: string, quantity: number, length?: string, color?: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  applyCoupon: (code: string) => Promise<boolean>;
  coupon: string | null;
  discount: number;
  cupomInfo: CupomAplicado | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/** Válido se o item do carrinho se enquadra no escopo do cupom aplicado. */
function itemElegivel(item: CartItem, cupom: CupomAplicado): boolean {
  if (cupom.escopo === 'marca') {
    return Boolean(cupom.marca) && (item.origin || '').trim().toLowerCase() === cupom.marca!.trim().toLowerCase();
  }
  if (cupom.escopo === 'produtos') {
    return Array.isArray(cupom.produtos) && cupom.produtos.includes(item.id);
  }
  return true;
}

/** Subtotal que o cupom incide (respeitando o escopo). Cupom sem info assume 'todos'. */
function subtotalElegivel(items: CartItem[], cupom: CupomAplicado | null, discount: number): number {
  if (!cupom) return 0;
  if (discount <= 0) return 0;
  return items.reduce((soma, i) => soma + (itemElegivel(i, cupom) ? i.price * i.quantity : 0), 0);
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [cupomInfo, setCupomInfo] = useState<CupomAplicado | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('fh_cart');
        if (saved) setItems(JSON.parse(saved));
        const savedCoupon = localStorage.getItem('fh_coupon');
        if (savedCoupon) {
          const parsed = JSON.parse(savedCoupon);
          setCoupon(parsed.code);
          setDiscount(parsed.discount);
          if (parsed.info) setCupomInfo(parsed.info);
        }
      } catch { /* ignore */ }
      setIsLoaded(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('fh_cart', JSON.stringify(items));
    }
  }, [items, isLoaded]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === newItem.id && i.length === newItem.length && i.color === newItem.color);
      if (existing) {
        return prev.map(i =>
          i.id === existing.id && i.length === existing.length && i.color === existing.color
            ? { ...i, quantity: i.quantity + newItem.quantity }
            : i
        );
      }
      return [...prev, newItem];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((id: string, length?: string, color?: string) => {
    setItems(prev => prev.filter(i => {
      if (length !== undefined && color !== undefined) {
        return !(i.id === id && i.length === length && i.color === color);
      }
      return !(i.id === id);
    }));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number, length?: string, color?: string) => {
    if (quantity <= 0) {
      removeItem(id, length, color);
      return;
    }
    setItems(prev => prev.map(i => {
      if (length !== undefined && color !== undefined) {
        return (i.id === id && i.length === length && i.color === color) ? { ...i, quantity } : i;
      }
      return i.id === id ? { ...i, quantity } : i;
    }));
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
    setDiscount(0);
    setCupomInfo(null);
    localStorage.removeItem('fh_coupon');
  }, []);

  const applyCoupon = useCallback(async (code: string): Promise<boolean> => {
    const upper = code.toUpperCase().trim();
    if (!upper) return false;
    try {
      const res = await fetch(`/api/cupons/validar?codigo=${encodeURIComponent(upper)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && data.cupom) {
        const info: CupomAplicado = {
          codigo: String(data.cupom.codigo || upper),
          descontoPercent: Number(data.cupom.descontoPercent) || 0,
          escopo: data.cupom.escopo || 'todos',
          marca: data.cupom.marca || null,
          produtos: Array.isArray(data.cupom.produtos) ? data.cupom.produtos.map(String) : [],
        };
        setCoupon(info.codigo);
        setDiscount(info.descontoPercent);
        setCupomInfo(info);
        localStorage.setItem('fh_coupon', JSON.stringify({ code: info.codigo, discount: info.descontoPercent, info }));
        return true;
      }
    } catch { /* cupom inválido/erro de rede */ }
    return false;
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const base = subtotalElegivel(items, cupomInfo, discount);
  const totalPrice = subtotal - base * (discount / 100);

  return (
    <CartContext.Provider value={{
      items, totalItems, totalPrice, isOpen,
      addItem, removeItem, updateQuantity, clearCart,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen(p => !p),
      applyCoupon, coupon, discount, cupomInfo,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

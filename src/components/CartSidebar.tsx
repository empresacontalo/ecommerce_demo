'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

export default function CartSidebar() {
  const { items, totalItems, totalPrice, isOpen, closeCart, removeItem, updateQuantity, applyCoupon, coupon, discount, cupomInfo } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const handleCoupon = async () => {
    setAplicando(true);
    const ok = await applyCoupon(couponInput);
    setAplicando(false);
    if (ok) {
      setCouponMsg({ type: 'success', text: `Coupon applied! ${discount}% OFF` });
    } else {
      setCouponMsg({ type: 'error', text: 'Invalid coupon or expired campaign' });
    }
    setTimeout(() => setCouponMsg(null), 4000);
  };

  return (
    <>
      {/* Overlay */}
      <div className={`cart-overlay ${isOpen ? 'active' : ''}`} onClick={closeCart} />

      {/* Sidebar */}
      <aside className={`cart-sidebar ${isOpen ? 'open' : ''}`} aria-label="Shopping cart">
        {/* Header */}
        <div className="cart-sidebar-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Cart ({totalItems})
          </h3>
          <button className="cart-close-btn" onClick={closeCart} aria-label="Close cart">✕</button>
        </div>

        {/* Body */}
        <div className="cart-sidebar-body">
          {items.length === 0 ? (
            <div className="cart-empty">
              <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-lg)' }}>🛒</div>
              <h4>Your cart is empty</h4>
              <p>Explore our luxury fragrance collection and find your signature scent.</p>
              <Link href="/catalogo" className="btn btn-primary" onClick={closeCart}>
                Explore Catalog
              </Link>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <div key={`${item.id}-${item.length || ''}-${item.color || ''}`} className="cart-item">
                  <div className="cart-item-image">
                    <Image src={item.image} alt={item.name} width={72} height={90} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  </div>
                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.name}</p>
                    <p className="cart-item-meta">
                      {item.origin}
                      {item.length ? ` · ${item.length}` : ''}
                    </p>
                    <div className="cart-item-bottom">
                      <div className="cart-qty-controls">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.length, item.color)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.length, item.color)}>+</button>
                      </div>
                      <span className="cart-item-price">R$ {(item.price * item.quantity).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                  <button className="cart-item-remove" onClick={() => removeItem(item.id, item.length, item.color)} aria-label="Remove item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}

              {/* Coupon */}
              <div className="cart-coupon">
                <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                  <input
                    className="input"
                    placeholder="Discount code"
                    value={couponInput}
                    onChange={e => setCouponInput(e.target.value)}
                    style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: 'var(--text-sm)' }}
                    disabled={!!coupon}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={handleCoupon} disabled={!!coupon || aplicando}>
                    {aplicando ? '…' : coupon ? '✓' : 'Apply'}
                  </button>
                </div>
                {couponMsg && (
                  <p style={{ fontSize: 'var(--text-xs)', marginTop: 4, color: couponMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {couponMsg.text}
                  </p>
                )}
                {coupon && (
                  <p style={{ fontSize: 'var(--text-xs)', marginTop: 4, color: 'var(--color-success)' }}>
                    ✅ {coupon} — {discount}% off
                    {cupomInfo?.escopo === 'marca' && ` on ${cupomInfo.marca} only`}
                    {cupomInfo?.escopo === 'produtos' && ` on selected products only`}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="cart-sidebar-footer">
            {discount > 0 && (
              <div className="cart-summary-row">
                <span>Discount ({discount}%)</span>
                <span style={{ color: 'var(--color-success)' }}>
                  -R$ {Math.max(0, items.reduce((s, i) => s + i.price * i.quantity, 0) - totalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="cart-summary-row cart-total">
              <span>Total</span>
              <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <Link href="/loja/checkout" className="btn btn-gold btn-lg" onClick={closeCart} style={{ width: '100%' }}>
              Checkout
            </Link>
            <Link href="/loja/carrinho" className="btn btn-ghost btn-sm" onClick={closeCart} style={{ width: '100%' }}>
              View Full Cart
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}

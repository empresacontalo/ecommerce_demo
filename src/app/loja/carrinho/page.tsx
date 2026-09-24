'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import Image from 'next/image';
import Link from 'next/link';

export default function CarrinhoPage() {
  const { items, totalPrice, updateQuantity, removeItem, discount, applyCoupon, coupon, cupomInfo } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountVal = Math.max(0, subtotal - totalPrice);

  const handleCoupon = async () => {
    setAplicando(true);
    const ok = await applyCoupon(couponInput);
    setAplicando(false);
    if (ok) {
      setCouponMsg({ type: 'success', text: `Cupom aplicado! ${discount}% OFF` });
    } else {
      setCouponMsg({ type: 'error', text: 'Cupom inválido ou campanha encerrada' });
    }
    setTimeout(() => setCouponMsg(null), 4000);
  };

  if (items.length === 0) {
    return (
      <section className="section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>🛒</div>
          <h2>Seu carrinho está vazio</h2>
          <p style={{ margin: 'var(--spacing-md) 0 var(--spacing-xl)', color: 'var(--color-text-secondary)' }}>Explore nosso catálogo de perfumes árabes e encontre a sua fragrância!</p>
          <Link href="/catalogo" className="btn btn-primary btn-lg">Ver Catálogo</Link>
        </div>
      </section>
    );
  }

  return (
    <div style={{ background: 'var(--color-surface-alt)', minHeight: '100vh', padding: 'var(--spacing-xl) 0' }}>
      <div className="container">
        <h1 style={{ marginBottom: 'var(--spacing-xl)', fontSize: '2.5rem', color: 'var(--color-primary)' }}>Meu Carrinho</h1>
        
        <div className="checkout-container">
          {/* Main Content - Cart Items */}
          <div className="checkout-main">
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-xl)', border: '1px solid var(--color-border)' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                {items.map((item) => (
                  <div key={`${item.id}-${item.length || ''}-${item.color || ''}`} style={{ display: 'flex', gap: 'var(--spacing-lg)', borderBottom: '1px solid var(--color-border-light)', paddingBottom: 'var(--spacing-lg)' }}>
                    {/* Imagem do Produto */}
                    <div style={{ width: 120, height: 150, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#eee', flexShrink: 0 }}>
                      <Image src={item.image} alt={item.name} width={120} height={150} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    </div>
                    
                    {/* Detalhes do Produto */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--spacing-xs)' }}>{item.name}</h3>
                          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                            {item.origin}
                          </p>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id, item.length, item.color)} 
                          style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: 'var(--spacing-xs)' }}
                          aria-label="Remover item"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>

                      {/* Quantidade e Preço */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--spacing-md)' }}>
                        <div className="cart-qty-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-dark-soft)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}>
                          <button onClick={() => updateQuantity(item.id, item.quantity - 1, item.length, item.color)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>−</button>
                          <span style={{ fontWeight: 'bold' }}>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1, item.length, item.color)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>+</button>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          {item.priceOld && (
                            <div style={{ textDecoration: 'line-through', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                              R$ {(item.priceOld * item.quantity).toLocaleString('pt-BR')}
                            </div>
                          )}
                          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                            R$ {(item.price * item.quantity).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* Sidebar - Order Summary */}
          <div className="checkout-sidebar">
            <h3 style={{ marginBottom: 'var(--spacing-lg)' }}>Resumo do Pedido</h3>
            
            {/* Cupom de Desconto */}
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <label className="label">Cupom de Desconto</label>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Insira seu cupom"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value)}
                  style={{ flex: 1 }}
                  disabled={!!coupon}
                />
                <button className="btn btn-secondary" onClick={handleCoupon} disabled={!!coupon || aplicando}>
                  {aplicando ? '…' : coupon ? 'Aplicado ✓' : 'Aplicar'}
                </button>
              </div>
              {couponMsg && (
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--spacing-xs)', color: couponMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {couponMsg.text}
                </p>
              )}
              {coupon && (
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--spacing-xs)', color: 'var(--color-success)' }}>
                  ✅ {coupon} — {discount}% OFF
                  {cupomInfo?.escopo === 'marca' && ` apenas em ${cupomInfo.marca}`}
                  {cupomInfo?.escopo === 'produtos' && ' apenas em produtos selecionados'}
                </p>
              )}
            </div>

            {/* Totais */}
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Subtotal ({items.length} itens)</span>
                <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                  <span>Desconto ({discount}%)</span>
                  <span>- R$ {discountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                <span>Frete</span>
                <span>Calculado no checkout</span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border-light)', marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>
              <span>Total</span>
              <span>R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div style={{ marginTop: 'var(--spacing-xl)' }}>
              <Link href="/loja/checkout" className="btn btn-gold btn-lg" style={{ width: '100%', textAlign: 'center', display: 'block', marginBottom: 'var(--spacing-md)' }}>
                Ir para o Checkout
              </Link>
              <Link href="/catalogo" className="btn btn-ghost" style={{ width: '100%', textAlign: 'center', display: 'block' }}>
                Continuar Comprando
              </Link>
            </div>
            
            {/* Trust Badges */}
            <div style={{ marginTop: 'var(--spacing-xl)', paddingTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-light)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                <span>Pagamento 100% Seguro</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <span>Entrega Rápida e Garantida</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { abrirChatComMensagem } from '@/components/ChatWidget';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number | string | null;
  price_old?: number | string | null;
  origin?: string | null;
  images?: string[] | null;
  badge?: string | null;
  stock?: number | string | null;
  description?: string | null;
}

export default function ProductCard({ product }: { product: Product }) {
  const badge = product.badge || '';
  const isPromo = badge.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'promocao';
  const priceNum = Number(product.price);
  const priceOldNum = product.price_old != null ? Number(product.price_old) : null;
  const esgotado = Number(product.stock) <= 0;

  const pedirPeloChat = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    abrirChatComMensagem({ nome: product.name, descricao: product.description || '' });
  };

  return (
    <Link
      href={esgotado ? '#' : `/catalogo/produto/${product.slug}`}
      className="card product-card reveal"
      style={{ textDecoration: 'none' }}
      onClick={esgotado ? (e) => e.preventDefault() : undefined}
    >
      {esgotado ? (
        <span className="badge badge-error product-badge">Esgotado</span>
      ) : (
        badge && (
          <span className={`badge ${isPromo ? 'badge-error' : 'badge-gold'} product-badge`}>
            {badge}
          </span>
        )
      )}
      <div className="product-image-wrap">
        <Image
          src={product.images?.[0] || '/images/placeholder.png'}
          alt={product.name}
          width={400}
          height={500}
          className="object-cover w-full h-full"
        />
        <div className="product-actions-overlay">
          {esgotado ? (
            <button
              onClick={pedirPeloChat}
              className="btn btn-gold btn-sm"
              style={{ flex: 1, cursor: 'pointer', border: 'none' }}
            >
              💬 Pedir pelo Chat
            </button>
          ) : (
            <span className="btn btn-primary btn-sm" style={{ flex: 1 }}>Ver Produto</span>
          )}
        </div>
      </div>
      <div className="product-info">
        <div className="product-origin">{product.origin}</div>
        <div className="product-name">{product.name}</div>
        <div className="product-price-row">
          {priceOldNum && (
            <span className="card-price-old">R$ {priceOldNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          )}
          <span className="card-price">R$ {priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </Link>
  );
}
